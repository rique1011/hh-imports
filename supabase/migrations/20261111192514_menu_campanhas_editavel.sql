-- Menu superior e campanhas sazonais. Ocultar preserva o URL e as peças vinculadas.
CREATE TABLE public.loja_navegacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 1 AND 80 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 2 AND 60 AND nome !~ '[<>[:cntrl:]]'),
  descricao text NOT NULL DEFAULT '' CHECK (char_length(descricao) <= 240 AND descricao !~ '[<>[:cntrl:]]'),
  tipo text NOT NULL CHECK (tipo IN ('selecao','categorias','colecoes','catalogo')),
  regra text NOT NULL DEFAULT 'manual' CHECK (regra IN ('manual','recentes') AND (tipo='selecao' OR regra='manual')),
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem BETWEEN 0 AND 999),
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0)
);
INSERT INTO public.loja_navegacao(slug,nome,descricao,tipo,regra,ordem) VALUES
  ('lancamentos','Lançamentos','Novas peças para fazer parte da sua história.','selecao','recentes',0),
  ('joias','Joias','','categorias','manual',1),
  ('masculino','Masculino','Personalidade em cada detalhe. Uma seleção feita pela H&H.','selecao','manual',2),
  ('presentes','Presentes','Escolhas para surpreender e celebrar quem importa.','selecao','manual',3),
  ('colecoes','Coleções','','colecoes','manual',4);

ALTER TABLE public.loja_navegacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loja_navegacao FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.loja_navegacao TO anon, authenticated;
GRANT ALL ON public.loja_navegacao TO service_role;
-- Não há dados privados: campanhas fora do menu continuam acessíveis por seus links.
CREATE POLICY navegacao_publica ON public.loja_navegacao FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.produtos DROP CONSTRAINT produtos_vitrines_validas;
ALTER TABLE public.produtos ADD CONSTRAINT produtos_vitrines_validas CHECK (
  cardinality(vitrines) <= 100 AND array_position(vitrines, NULL) IS NULL
);
-- Vincular somente campanhas cadastradas, inclusive as retiradas temporariamente do menu.
CREATE FUNCTION public.hh_validar_vitrines_produto() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF cardinality(NEW.vitrines) <> (SELECT count(DISTINCT slug) FROM unnest(NEW.vitrines) AS v(slug))
    OR EXISTS (
      SELECT 1 FROM unnest(NEW.vitrines) AS v(slug)
      WHERE NOT EXISTS (SELECT 1 FROM public.loja_navegacao AS n WHERE n.slug=v.slug AND n.tipo='selecao')
    ) THEN
    RAISE EXCEPTION 'produtos_vitrines_validas: selecione campanhas cadastradas, sem repetições.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hh_validar_vitrines_produto() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hh_validar_vitrines_produto() TO service_role;
CREATE TRIGGER hh_produtos_vitrines BEFORE INSERT OR UPDATE OF vitrines ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.hh_validar_vitrines_produto();

NOTIFY pgrst, 'reload schema';
