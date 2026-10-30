begin;
set local lock_timeout = '3s';

alter table public.produtos add column if not exists estoque integer default 0;
alter table public.produtos add column if not exists estoque_reservado integer not null default 0;
alter table public.produtos add constraint estoque_reservado_valido check (estoque_reservado>=0 and coalesce(estoque,0)>=estoque_reservado);
alter table public.pedidos add column if not exists estoque_reservado_em timestamptz;
alter table public.pedidos add column if not exists estoque_baixado_em timestamptz;
alter table public.pedidos add column if not exists estoque_liberado_em timestamptz;
alter table public.pedidos add column if not exists cashback_debitado numeric not null default 0;
alter table public.pedidos add column if not exists cashback_estornado_em timestamptz;

-- Histórico já pago não é debitado retroativamente: falta o inventário histórico.
update public.pedidos set estoque_baixado_em=coalesce(created_at,now())
where status in ('pago','confirmado','processando','enviado','entregue') and estoque_baixado_em is null;

-- Usa o tipo real da chave de pedidos (bigint no ambiente auditado).
do $$
declare tipo_id text;
begin
  select format_type(atttypid,atttypmod) into tipo_id from pg_attribute
    where attrelid='public.pedidos'::regclass and attname='id' and not attisdropped;
  execute format('create table public.pedido_itens (
    pedido_id %s not null references public.pedidos(id) on delete cascade,
    linha integer not null,
    produto_id uuid references public.produtos(id) on delete set null,
    produto_referencia text not null,
    nome text not null,
    quantidade integer not null check (quantidade > 0),
    preco_unitario numeric not null check (preco_unitario >= 0),
    primary key (pedido_id,linha))',tipo_id);
end $$;
alter table public.pedido_itens enable row level security;
revoke all on public.pedido_itens from public,anon,authenticated;
grant all on public.pedido_itens to service_role;
create index pedido_itens_produto_idx on public.pedido_itens(produto_id);

create or replace function public.hh_controlar_estoque_pedido()
returns trigger language plpgsql security invoker set search_path=public as $$
declare item record; produto record; quantidade_total bigint; reservar boolean; baixar boolean; liberar boolean;
begin
  reservar := tg_op='INSERT' and new.status='pendente';
  baixar := new.status in ('pago','confirmado','processando','enviado','entregue') and new.estoque_baixado_em is null;
  liberar := tg_op='UPDATE' and new.status='cancelado' and old.estoque_reservado_em is not null
    and old.estoque_baixado_em is null and old.estoque_liberado_em is null;
  if not (reservar or baixar or liberar) then return new; end if;
  if baixar and new.estoque_liberado_em is not null then raise exception 'Pedido liberado requer conciliacao antes de confirmar'; end if;
  if jsonb_typeof(new.itens) is distinct from 'array' or jsonb_array_length(new.itens)=0 then raise exception 'Itens invalidos'; end if;
  if exists(select 1 from jsonb_array_elements(new.itens) i where
    coalesce(i->>'id','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(i->>'quantidade','') !~ '^[1-9][0-9]{0,3}$') then raise exception 'Itens invalidos'; end if;
  -- A compra bloqueia o usuário antes dos produtos; aprovação/cancelamento
  -- seguem a mesma ordem para não formar ciclos entre cashback e estoque.
  perform 1 from public.usuarios where email=new.cliente_email for update;
  -- Mesma ordem de locks em todas as compras para evitar deadlocks.
  for item in select (i->>'id')::uuid as id,sum((i->>'quantidade')::integer) as quantidade
    from jsonb_array_elements(new.itens) i group by 1 order by 1 loop
    quantidade_total := item.quantidade;
    if quantidade_total > 9999 then raise exception 'Quantidade invalida'; end if;
    select * into produto from public.produtos where id=item.id for update;
    if not found then raise exception 'Produto indisponivel'; end if;
    if liberar then
      if produto.estoque_reservado < quantidade_total then raise exception 'Reserva inconsistente'; end if;
      update public.produtos set estoque_reservado=estoque_reservado-quantidade_total where id=item.id;
    elsif baixar and new.estoque_reservado_em is not null then
      if produto.estoque_reservado < quantidade_total or coalesce(produto.estoque,0) < quantidade_total then raise exception 'Reserva inconsistente'; end if;
      update public.produtos set estoque=estoque-quantidade_total,estoque_reservado=estoque_reservado-quantidade_total where id=item.id;
    else
      if coalesce(produto.estoque,0)-produto.estoque_reservado < quantidade_total then raise exception 'Estoque insuficiente'; end if;
      if reservar then update public.produtos set estoque_reservado=estoque_reservado+quantidade_total where id=item.id;
      else update public.produtos set estoque=estoque-quantidade_total where id=item.id; end if;
    end if;
  end loop;
  if reservar then new.estoque_reservado_em=now(); end if;
  if baixar then new.estoque_baixado_em=now(); end if;
  if liberar then
    new.estoque_liberado_em=now();
    if old.cashback_debitado>0 and old.cashback_estornado_em is null then
      update public.usuarios set saldo_cashback=coalesce(saldo_cashback,0)+old.cashback_debitado where email=old.cliente_email;
      new.cashback_estornado_em=now();
    end if;
  end if;
  return new;
end $$;

create or replace function public.hh_normalizar_itens_pedido()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  insert into public.pedido_itens(pedido_id,linha,produto_id,produto_referencia,nome,quantidade,preco_unitario)
  select new.id,ordinalidade::integer,(i->>'id')::uuid,i->>'id',coalesce(i->>'nome','Produto'),
    (i->>'quantidade')::integer,(i->>'preco')::numeric
  from jsonb_array_elements(new.itens) with ordinality as itens(i,ordinalidade);
  return new;
end $$;

create trigger hh_estoque_pedido before insert or update of status on public.pedidos
  for each row execute function public.hh_controlar_estoque_pedido();
create trigger hh_itens_pedido after insert on public.pedidos
  for each row execute function public.hh_normalizar_itens_pedido();

create or replace function public.hh_criar_pedido(
  p_email text,p_nome text,p_total numeric,p_itens jsonb,p_cashback numeric default 0
) returns jsonb language plpgsql security definer set search_path=public as $$
declare pedido jsonb; usuario record;
begin
  if p_total is null or p_total<0 or p_cashback is null or p_cashback<0 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Dados do pedido invalidos'; end if;
  select * into usuario from public.usuarios where email=p_email for update;
  if not found then raise exception 'Usuario nao encontrado'; end if;
  if p_cashback>0 then
    update public.usuarios set saldo_cashback=coalesce(saldo_cashback,0)-p_cashback
      where id=usuario.id and coalesce(saldo_cashback,0)>=p_cashback;
    if not found then raise exception 'Saldo de cashback insuficiente'; end if;
  end if;
  insert into public.pedidos(cliente_email,cliente_nome,status,total,itens,codigo_rastreio,cashback_debitado)
    values(p_email,p_nome,case when p_total=0 then 'pago' else 'pendente' end,p_total,p_itens,null,p_cashback)
    returning to_jsonb(pedidos.*) into pedido;
  return pedido;
end $$;

revoke all on function public.hh_controlar_estoque_pedido() from public,anon,authenticated;
revoke all on function public.hh_normalizar_itens_pedido() from public,anon,authenticated;
revoke all on function public.hh_criar_pedido(text,text,numeric,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.hh_criar_pedido(text,text,numeric,jsonb,numeric) to service_role;
notify pgrst, 'reload schema';
commit;
