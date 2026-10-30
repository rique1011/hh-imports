-- Aplique uma vez no Supabase antes de publicar o codigo.
begin;

alter table public.pedidos add column if not exists mp_payment_id text;
alter table public.pedidos add column if not exists cashback_creditado_em timestamptz;

-- Preserva o cashback de pedidos ja pagos pela implementacao anterior.
update public.pedidos
set cashback_creditado_em = coalesce(created_at, now())
where status in ('confirmado', 'pago', 'processando', 'enviado', 'entregue')
  and cashback_creditado_em is null;

create unique index if not exists pedidos_mp_payment_id_unique
  on public.pedidos (mp_payment_id) where mp_payment_id is not null;

create table if not exists public.pedido_notificacoes (
  id bigint generated always as identity primary key,
  pedido_id text not null,
  evento text not null check (evento in ('novo_pedido','pagamento_aprovado','enviado','entregue')),
  destinatario text not null check (destinatario in ('cliente','admin')),
  payload jsonb not null,
  status text not null default 'pendente' check (status in ('pendente','processando','enviada')),
  tentativas integer not null default 0,
  disponivel_em timestamptz not null default now(),
  locked_until timestamptz,
  lease_id uuid,
  enviada_em timestamptz,
  erro text,
  criado_em timestamptz not null default now(),
  unique (pedido_id, evento, destinatario)
);
alter table public.pedido_notificacoes enable row level security;
revoke all on public.pedido_notificacoes from public, anon, authenticated;
grant all on public.pedido_notificacoes to service_role;
grant usage, select on sequence public.pedido_notificacoes_id_seq to service_role;

create or replace function public.hh_enqueue_notification(
  p_pedido jsonb, p_evento text, p_destinatario text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_destinatario = 'cliente' and
     coalesce(p_pedido->>'cliente_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return;
  end if;
  insert into public.pedido_notificacoes(pedido_id, evento, destinatario, payload)
  values(p_pedido->>'id', p_evento, p_destinatario,
    jsonb_build_object(
      'id',p_pedido->>'id','cliente_email',p_pedido->>'cliente_email',
      'cliente_nome',coalesce(p_pedido->>'cliente_nome','Cliente'),
      'total',p_pedido->'total','status',p_pedido->>'status',
      'itens',coalesce(p_pedido->'itens','[]'::jsonb),
      'codigo_rastreio',p_pedido->>'codigo_rastreio'
    ))
  on conflict(pedido_id, evento, destinatario) do nothing;
end;
$$;

create or replace function public.hh_order_notifications_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare dados jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    perform public.hh_enqueue_notification(dados,'novo_pedido','cliente');
    perform public.hh_enqueue_notification(dados,'novo_pedido','admin');
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status in ('confirmado','pago') then
      perform public.hh_enqueue_notification(dados,'pagamento_aprovado','cliente');
      perform public.hh_enqueue_notification(dados,'pagamento_aprovado','admin');
    elsif new.status in ('enviado','entregue') then
      perform public.hh_enqueue_notification(dados,new.status,'cliente');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists hh_order_notifications on public.pedidos;
create trigger hh_order_notifications
after insert or update of status, codigo_rastreio on public.pedidos
for each row execute function public.hh_order_notifications_trigger();

create or replace function public.hh_criar_pedido(
  p_email text, p_nome text, p_total numeric, p_itens jsonb, p_cashback numeric default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare pedido jsonb;
begin
  if p_total is null or p_total < 0 or p_cashback is null or p_cashback < 0
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Dados do pedido invalidos';
  end if;
  if p_cashback > 0 then
    update public.usuarios set saldo_cashback = coalesce(saldo_cashback,0) - p_cashback
    where email = p_email and coalesce(saldo_cashback,0) >= p_cashback;
    if not found then raise exception 'Saldo de cashback insuficiente'; end if;
  end if;
  insert into public.pedidos(cliente_email,cliente_nome,status,total,itens,codigo_rastreio)
  values(p_email,p_nome,case when p_total = 0 then 'pago' else 'pendente' end,p_total,p_itens,null)
  returning to_jsonb(pedidos.*) into pedido;
  return pedido;
end;
$$;

create or replace function public.hh_confirmar_pagamento(
  p_pedido_id text, p_pagamento_id text, p_total numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare pedido jsonb; primeira_confirmacao boolean;
begin
  select to_jsonb(p.*) into pedido from public.pedidos p
  where p.id::text = p_pedido_id for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  if p_total is null or round((pedido->>'total')::numeric,2) <> round(p_total,2) then
    raise exception 'Valor do pagamento diferente do pedido';
  end if;
  if p_pagamento_id is null or p_pagamento_id = '' then raise exception 'Pagamento invalido'; end if;
  if pedido->>'mp_payment_id' is not null and pedido->>'mp_payment_id' <> p_pagamento_id then
    raise exception 'Pedido ja associado a outro pagamento';
  end if;
  primeira_confirmacao := pedido->>'cashback_creditado_em' is null;
  update public.pedidos
  set mp_payment_id = p_pagamento_id,
      status = case when status in ('processando','enviado','entregue') then status else 'confirmado' end,
      cashback_creditado_em = coalesce(cashback_creditado_em, now())
  where id::text = p_pedido_id returning to_jsonb(pedidos.*) into pedido;

  if primeira_confirmacao then
    update public.usuarios
    set saldo_cashback = coalesce(saldo_cashback,0) + round(p_total * 0.05,2)
    where email = pedido->>'cliente_email';
  end if;

  -- Retoma tambem pedidos confirmados antes da fila existir.
  perform public.hh_enqueue_notification(pedido,'pagamento_aprovado','cliente');
  perform public.hh_enqueue_notification(pedido,'pagamento_aprovado','admin');
  return pedido;
end;
$$;

create or replace function public.hh_claim_notifications(
  p_pedido_id text default null, p_limite integer default 10
) returns setof public.pedido_notificacoes language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidatos as (
    select id from public.pedido_notificacoes
    where ((status = 'pendente' and disponivel_em <= now())
      or (status = 'processando' and locked_until <= now()))
      and (p_pedido_id is null or pedido_id = p_pedido_id)
    order by id limit greatest(1,least(coalesce(p_limite,10),20))
    for update skip locked
  )
  update public.pedido_notificacoes n
  set status = 'processando', locked_until = now() + interval '3 minutes',
      lease_id = gen_random_uuid(), tentativas = tentativas + 1
  from candidatos c where n.id = c.id
  returning n.*;
end;
$$;

revoke all on function public.hh_enqueue_notification(jsonb,text,text) from public,anon,authenticated;
revoke all on function public.hh_order_notifications_trigger() from public,anon,authenticated;
revoke all on function public.hh_criar_pedido(text,text,numeric,jsonb,numeric) from public,anon,authenticated;
revoke all on function public.hh_confirmar_pagamento(text,text,numeric) from public,anon,authenticated;
revoke all on function public.hh_claim_notifications(text,integer) from public,anon,authenticated;
grant execute on function public.hh_criar_pedido(text,text,numeric,jsonb,numeric) to service_role;
grant execute on function public.hh_confirmar_pagamento(text,text,numeric) to service_role;
grant execute on function public.hh_claim_notifications(text,integer) to service_role;

notify pgrst, 'reload schema';
commit;

