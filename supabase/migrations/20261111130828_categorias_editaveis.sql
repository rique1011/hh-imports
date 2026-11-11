-- Categorias públicas para leitura; toda edição passa pela API de admin com MFA.
CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE
);
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0 CHECK (ordem BETWEEN 0 AND 999),
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1 CHECK (versao > 0);

INSERT INTO public.categorias(nome,slug,ordem) VALUES
  ('Colares','colares',1), ('Pulseiras','pulseiras',2), ('Brincos','brincos',3),
  ('Anéis','aneis',4), ('Relógios','relogios',5), ('Outras peças','outros',6)
ON CONFLICT(slug) DO NOTHING;

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categorias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.categorias TO anon, authenticated;
GRANT ALL ON public.categorias TO service_role;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categorias' AND policyname='categorias_publicas') THEN
    CREATE POLICY categorias_publicas ON public.categorias FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
