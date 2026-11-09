-- Configuração visual privada: somente o servidor publica os campos da vitrine.
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS vitrines text[] NOT NULL DEFAULT '{}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.produtos'::regclass AND conname='produtos_vitrines_validas') THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_vitrines_validas CHECK (
      vitrines <@ ARRAY['lancamentos','masculino','presentes']::text[]
      AND array_position(vitrines, NULL) IS NULL AND cardinality(vitrines) <= 3
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS produtos_vitrines_idx ON public.produtos USING gin (vitrines);

CREATE TABLE IF NOT EXISTS public.loja_aparencia (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  config jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(config)='object'),
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text
);
ALTER TABLE public.loja_aparencia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loja_aparencia FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_aparencia TO service_role;
INSERT INTO public.loja_aparencia (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
NOTIFY pgrst, 'reload schema';
