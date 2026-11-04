begin;

alter table public.pedidos add column if not exists entrega jsonb;
alter table public.pedidos add column if not exists frete_cotacao jsonb;

do $migration$
declare tipo_id text;
begin
  select pg_catalog.format_type(atttypid,atttypmod) into tipo_id from pg_catalog.pg_attribute
    where attrelid='public.pedidos'::regclass and attname='id';
  if tipo_id not in ('bigint','uuid') then raise exception 'Tipo de pedido nao suportado'; end if;
  execute pg_catalog.format($ddl$
create table if not exists public.pedido_envios (
  pedido_id %s primary key references public.pedidos(id) on delete restrict,
  ambiente text not null check (ambiente in ('production','sandbox')),
  me_id text unique,
  estado text not null default 'nova' check (estado in
    ('nova','inserindo','insercao_incerta','carrinho','comprando','compra_incerta','pago','gerando','aguardando_rastreio','pronta','bloqueada')),
  config jsonb not null,
  etiqueta_gerada boolean not null default false,
  codigo_rastreio text,
  erro text,
  lease_id uuid,
  locked_until timestamptz,
  atualizado_em timestamptz not null default now()
);
$ddl$,tipo_id);
end $migration$;
alter table public.pedido_envios enable row level security;
revoke all on public.pedido_envios from public, anon, authenticated;
grant select, insert, update on public.pedido_envios to service_role;
create index if not exists pedido_envios_pendentes_idx on public.pedido_envios(atualizado_em)
  where me_id is not null and estado not in ('pronta','bloqueada');

-- A função já existente cuida de estoque, cashback e fila de notificações.
-- O wrapper guarda o endereço e a cotação na mesma transação que cria o pedido.
create or replace function public.hh_criar_pedido_com_envio(
  p_email text, p_nome text, p_total numeric, p_itens jsonb, p_cashback numeric,
  p_entrega jsonb, p_frete jsonb default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare resultado jsonb;
begin
  if jsonb_typeof(p_entrega) is distinct from 'object' or coalesce(p_entrega->>'cep','') !~ '^\d{8}$' then
    raise exception 'Endereco de entrega invalido';
  end if;
  resultado := public.hh_criar_pedido(p_email,p_nome,p_total,p_itens,p_cashback);
  update public.pedidos set entrega=p_entrega,frete_cotacao=p_frete where id::text=resultado->>'id';
  return resultado || jsonb_build_object('entrega',p_entrega,'frete_cotacao',p_frete);
end $$;

-- Mutex durável: uma única requisição opera este pedido por vez.
create or replace function public.hh_claim_envio(
  p_pedido_id text, p_lease uuid, p_ambiente text, p_config jsonb default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare pedido public.pedidos; envio public.pedido_envios;
begin
  select * into pedido from public.pedidos where id::text=p_pedido_id for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  select * into envio from public.pedido_envios where pedido_id=pedido.id for update;
  if not found then
    if coalesce(pedido.status,'') not in ('pago','confirmado','processando') or coalesce(pedido.codigo_rastreio,'')<>'' then
      raise exception 'Apenas pedidos pagos e sem rastreio podem gerar etiqueta';
    end if;
    if p_config is null then raise exception 'Cotacao e nota fiscal obrigatorias'; end if;
    insert into public.pedido_envios(pedido_id,ambiente,config) values(pedido.id,p_ambiente,p_config)
      returning * into envio;
    update public.pedidos set entrega=coalesce(entrega,p_config->'entrega') where id=pedido.id;
  end if;
  if envio.ambiente<>p_ambiente then raise exception 'Ambiente diferente da etiqueta original'; end if;
  if coalesce(pedido.status,'') not in ('pago','confirmado','processando','enviado','entregue') then
    raise exception 'Pedido sem pagamento confirmado';
  end if;
  if envio.locked_until>now() then raise exception 'Etiqueta em processamento'; end if;
  update public.pedido_envios set lease_id=p_lease,locked_until=now()+interval '3 minutes',
    config=case when estado='nova' and me_id is null and p_config is not null then p_config else config end,
    atualizado_em=now() where pedido_id=pedido.id returning * into envio;
  return to_jsonb(envio);
end $$;

-- Status + rastreio + estado da etiqueta são confirmados atomicamente.
-- O trigger hh_order_notifications enfileira o e-mail de enviado uma única vez.
create or replace function public.hh_finalizar_envio(p_pedido_id text,p_lease uuid,p_rastreio text)
returns void language plpgsql security invoker set search_path='' as $$
declare pedido public.pedidos; envio public.pedido_envios;
begin
  select * into pedido from public.pedidos where id::text=p_pedido_id for update;
  select * into envio from public.pedido_envios where pedido_id=pedido.id for update;
  if envio.lease_id is distinct from p_lease or envio.locked_until is null
    or envio.locked_until<=now() or not envio.etiqueta_gerada or envio.me_id is null or coalesce(p_rastreio,'')='' then
    raise exception 'Etiqueta ainda nao confirmada';
  end if;
  if coalesce(pedido.status,'') not in ('pago','confirmado','processando','enviado','entregue') then
    raise exception 'Pedido sem pagamento confirmado';
  end if;
  if coalesce(pedido.codigo_rastreio,'')<>'' and pedido.codigo_rastreio<>p_rastreio then
    raise exception 'Pedido ja possui outro rastreio';
  end if;
  update public.pedidos set codigo_rastreio=p_rastreio,
    status=case when status='entregue' then status else 'enviado' end where id=pedido.id;
  update public.pedido_envios set estado='pronta',codigo_rastreio=p_rastreio,erro=null,atualizado_em=now()
    where pedido_id=pedido.id;
end $$;

revoke all on function public.hh_criar_pedido_com_envio(text,text,numeric,jsonb,numeric,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.hh_claim_envio(text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.hh_finalizar_envio(text,uuid,text) from public,anon,authenticated;
grant execute on function public.hh_criar_pedido_com_envio(text,text,numeric,jsonb,numeric,jsonb,jsonb) to service_role;
grant execute on function public.hh_claim_envio(text,uuid,text,jsonb) to service_role;
grant execute on function public.hh_finalizar_envio(text,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
