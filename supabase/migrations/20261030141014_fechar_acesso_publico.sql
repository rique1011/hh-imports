begin;
set local lock_timeout = '3s';

-- NextAuth autentica no backend. Um cookie NextAuth não é um JWT Supabase.
-- Tabelas privadas são acessíveis somente pelo backend com service_role.
do $$
declare tabela text; politica record;
begin
  foreach tabela in array array['usuarios','pedidos','pedido_itens','trocas','carrinhos_abandonados','pedido_notificacoes','produtos','categorias','avaliacoes','cupons'] loop
    if to_regclass(format('public.%I', tabela)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', tabela);
    for politica in select policyname from pg_policies where schemaname='public' and tablename=tabela loop
      execute format('drop policy %I on public.%I', politica.policyname, tabela);
    end loop;
    execute format('revoke all on public.%I from public, anon, authenticated', tabela);
    execute format('grant all on public.%I to service_role', tabela);
  end loop;
end $$;

grant select on public.produtos, public.categorias, public.avaliacoes to anon, authenticated;
create policy catalogo_publico on public.produtos for select to anon, authenticated using (true);
create policy categorias_publicas on public.categorias for select to anon, authenticated using (true);
create policy avaliacoes_publicas on public.avaliacoes for select to anon, authenticated using (true);

revoke all on all sequences in schema public from public, anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

-- O upload passa pela API autenticada e validada, sem acesso anônimo ao bucket.
drop policy if exists "Permitir uploads no bucket joias" on storage.objects;
drop policy if exists joias_sem_upload_publico on storage.objects;
drop policy if exists joias_sem_update_publico on storage.objects;
drop policy if exists joias_sem_delete_publico on storage.objects;
create policy joias_sem_upload_publico on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'joias');
create policy joias_sem_update_publico on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id <> 'joias') with check (bucket_id <> 'joias');
create policy joias_sem_delete_publico on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id <> 'joias');

-- Estes índices únicos recusam a migração se houver duplicidades; nenhum dado é apagado.
create unique index if not exists usuarios_email_normalizado_unico on public.usuarios(lower(btrim(email))) where email is not null;
create unique index if not exists troca_item_unico on public.trocas(pedido_id,produto_id) where produto_id is not null;
create index if not exists pedidos_cliente_data_idx on public.pedidos(cliente_email,created_at desc);
create index if not exists pedidos_status_data_idx on public.pedidos(status,created_at desc);
create index if not exists produtos_categoria_idx on public.produtos(categoria_id);
create index if not exists produtos_categoria_slug_idx on public.produtos(categoria_slug,criado_em desc);
create index if not exists cupons_usuario_idx on public.cupons(usuario_id);
create index if not exists trocas_usuario_idx on public.trocas(usuario_id);
create index if not exists trocas_produto_idx on public.trocas(produto_id);
create index if not exists avaliacoes_produto_data_idx on public.avaliacoes(produto_id,created_at desc);
create index if not exists usuarios_recuperacao_idx on public.usuarios(recovery_token) where recovery_token is not null;
create index if not exists notificacoes_pendentes_idx on public.pedido_notificacoes(disponivel_em,id) where status='pendente';

notify pgrst, 'reload schema';
commit;
