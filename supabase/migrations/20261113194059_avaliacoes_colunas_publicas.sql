BEGIN;
SET LOCAL lock_timeout='5s';
-- A vitrine usa somente estes campos. O identificador pseudonimizado usado
-- para impedir avaliações duplicadas continua acessível apenas ao backend.
REVOKE SELECT ON TABLE public.avaliacoes FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,created_at,usuario_nome,nota,comentario,produto_id)
  ON public.avaliacoes TO anon,authenticated;
GRANT ALL ON TABLE public.avaliacoes TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
