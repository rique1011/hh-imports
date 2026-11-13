BEGIN;
SET LOCAL lock_timeout='5s';
-- NextAuth não entrega JWTs do Supabase ao navegador. Toda escrita passa
-- pela API da loja, com autenticação, MFA administrativo e service_role.
-- As regras anteriores eram RESTRICTIVE e não liberavam uploads sozinhas;
-- a negação total também protege buckets futuros contra um ALLOW acidental.
DROP POLICY IF EXISTS joias_sem_upload_publico ON storage.objects;
DROP POLICY IF EXISTS joias_sem_update_publico ON storage.objects;
DROP POLICY IF EXISTS joias_sem_delete_publico ON storage.objects;
CREATE POLICY storage_sem_upload_direto ON storage.objects AS RESTRICTIVE
  FOR INSERT TO anon,authenticated WITH CHECK (false);
CREATE POLICY storage_sem_update_direto ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO anon,authenticated USING (false) WITH CHECK (false);
CREATE POLICY storage_sem_delete_direto ON storage.objects AS RESTRICTIVE
  FOR DELETE TO anon,authenticated USING (false);
CREATE POLICY devolucoes_sem_leitura_direta ON storage.objects AS RESTRICTIVE
  FOR SELECT TO anon,authenticated USING (bucket_id <> 'devolucoes');
UPDATE storage.buckets SET file_size_limit=5242880,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']
  WHERE id IN ('joias','devolucoes');
UPDATE storage.buckets SET public=false WHERE id='devolucoes';
NOTIFY pgrst,'reload schema';
COMMIT;
