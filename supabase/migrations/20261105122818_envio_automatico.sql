begin;

-- Desativada por padrão: nenhum pedido antigo é comprado na instalação.
create table public.envio_automatico_config (
  id boolean primary key default true check (id),
  ativa boolean not null default false,
  documento_fiscal text not null default 'nfe' check (documento_fiscal in ('nfe','declaracao')),
  declaracao_confirmada boolean not null default false,
  limite_centavos integer check (limite_centavos between 1 and 10000000),
  servicos_gratis integer[] not null default array[1,2],
  agencia bigint check (agencia > 0),
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  check (not ativa or (limite_centavos is not null and
    (documento_fiscal='nfe' or declaracao_confirmada)))
);
insert into public.envio_automatico_config(id) values(true);

do $migration$
declare tipo_id text;
begin
  select pg_catalog.format_type(atttypid,atttypmod) into tipo_id from pg_catalog.pg_attribute
    where attrelid='public.pedidos'::regclass and attname='id';
  if tipo_id not in ('bigint','uuid') then raise exception 'Tipo de pedido nao suportado'; end if;
  execute pg_catalog.format($ddl$
create table public.envio_automatico_fila (
  pedido_id %s primary key references public.pedidos(id) on delete restrict,
  estado text not null default 'pendente' check (estado in
    ('pendente','processando','aguardando','aguardando_documento','atencao','concluida','manual')),
  config jsonb not null,
  nota_fiscal text check (nota_fiscal is null or nota_fiscal ~ '^\d{44}$'),
  tentativas integer not null default 0,
  proxima_tentativa timestamptz not null default now(),
  lease_id uuid,
  locked_until timestamptz,
  mensagem text not null default 'Pagamento confirmado. Preparando etiqueta automaticamente.',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
$ddl$,tipo_id);
end $migration$;
create index envio_automatico_pendente_idx on public.envio_automatico_fila(proxima_tentativa)
  where estado in ('pendente','processando','aguardando');

alter table public.envio_automatico_config enable row level security;
alter table public.envio_automatico_fila enable row level security;
revoke all on public.envio_automatico_config, public.envio_automatico_fila from public,anon,authenticated;
grant select,update on public.envio_automatico_config to service_role;
grant select,insert,update on public.envio_automatico_fila to service_role;

-- O pagamento e a entrada na fila são persistidos na mesma transação.
-- Replays do webhook e atualizações de endereço/status não criam outro trabalho.
create function public.hh_enfileirar_envio_automatico() returns trigger
language plpgsql security invoker set search_path='' as $$
declare config public.envio_automatico_config;
begin
  if coalesce(new.status,'') not in ('pago','confirmado','processando') then return new; end if;
  if tg_op='UPDATE' then
    if coalesce(old.status,'') in ('pago','confirmado','processando','enviado','entregue') then return new; end if;
  end if;
  if coalesce(new.codigo_rastreio,'')<>'' then return new; end if;
  select * into config from public.envio_automatico_config where id and ativa;
  if not found then return new; end if;
  if exists(select 1 from public.pedido_envios where pedido_id=new.id) then return new; end if;
  insert into public.envio_automatico_fila(pedido_id,config)
    values(new.id,to_jsonb(config)) on conflict(pedido_id) do nothing;
  return new;
end $$;
create trigger hh_envio_automatico_pagamento after insert or update of status on public.pedidos
  for each row execute function public.hh_enfileirar_envio_automatico();

-- SKIP LOCKED permite disputar trabalhos sem duplicar compras. A segunda trava
-- em pedido_envios também protege contra o cron/manual já existentes.
create function public.hh_claim_envio_automatico(p_lease uuid,p_pedido_id text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare trabalho public.envio_automatico_fila;
begin
  if not exists(select 1 from public.envio_automatico_config where id and ativa) then return null; end if;
  select * into trabalho from public.envio_automatico_fila
    where estado in ('pendente','processando','aguardando') and proxima_tentativa<=now()
      and (locked_until is null or locked_until<=now())
      and (p_pedido_id is null or pedido_id::text=p_pedido_id)
    order by proxima_tentativa,pedido_id for update skip locked limit 1;
  if not found then return null; end if;
  update public.envio_automatico_fila set estado='processando',lease_id=p_lease,
    locked_until=now()+interval '3 minutes',tentativas=tentativas+1,atualizado_em=now()
    where pedido_id=trabalho.pedido_id returning * into trabalho;
  return to_jsonb(trabalho);
end $$;

create function public.hh_retomar_envio_automatico(p_pedido_id text,p_nota_fiscal text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare trabalho public.envio_automatico_fila; configuracao public.envio_automatico_config;
begin
  select * into configuracao from public.envio_automatico_config where id and ativa;
  if not found then raise exception 'Ative a automacao antes de retomar'; end if;
  select * into trabalho from public.envio_automatico_fila where pedido_id::text=p_pedido_id for update;
  if not found then raise exception 'Pedido fora da fila automatica'; end if;
  if trabalho.estado in ('manual','concluida') then raise exception 'Pedido finalizado ou em modo manual'; end if;
  if trabalho.locked_until>now() then raise exception 'Etiqueta em processamento. Aguarde'; end if;
  if p_nota_fiscal is not null and p_nota_fiscal !~ '^\d{44}$' then raise exception 'Chave NF-e invalida'; end if;
  update public.envio_automatico_fila set estado='pendente',config=to_jsonb(configuracao),
    nota_fiscal=coalesce(p_nota_fiscal,nota_fiscal),tentativas=0,proxima_tentativa=now(),
    lease_id=null,locked_until=null,mensagem='Preparando etiqueta automaticamente.',atualizado_em=now()
    where pedido_id=trabalho.pedido_id returning * into trabalho;
  return to_jsonb(trabalho);
end $$;

-- A tela pode acompanhar etiquetas já compradas com frequência, mesmo no plano
-- Hobby (cron diário). Esta operação nunca libera um novo carrinho/checkout.
create function public.hh_sincronizar_envio_automatico(p_pedido_id text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.envio_automatico_fila fila set proxima_tentativa=now()
    where pedido_id::text=p_pedido_id and estado='aguardando'
      and (locked_until is null or locked_until<=now())
      and exists(select 1 from public.pedido_envios envio where envio.pedido_id=fila.pedido_id
        and envio.estado in ('comprando','compra_incerta','pago','gerando','aguardando_rastreio','pronta'));
  return found;
end $$;

create function public.hh_envio_automatico_manual(p_pedido_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare trabalho public.envio_automatico_fila;
begin
  select * into trabalho from public.envio_automatico_fila where pedido_id::text=p_pedido_id for update;
  if not found then return null; end if;
  if trabalho.locked_until>now() then raise exception 'Etiqueta em processamento. Aguarde'; end if;
  if trabalho.estado='concluida' then return to_jsonb(trabalho); end if;
  update public.envio_automatico_fila set estado='manual',lease_id=null,locked_until=null,
    mensagem='Automacao suspensa para este pedido. Continue no modo manual.',atualizado_em=now()
    where pedido_id=trabalho.pedido_id returning * into trabalho;
  return to_jsonb(trabalho);
end $$;

revoke all on function public.hh_enfileirar_envio_automatico() from public,anon,authenticated;
revoke all on function public.hh_claim_envio_automatico(uuid,text) from public,anon,authenticated;
revoke all on function public.hh_retomar_envio_automatico(text,text) from public,anon,authenticated;
revoke all on function public.hh_envio_automatico_manual(text) from public,anon,authenticated;
revoke all on function public.hh_sincronizar_envio_automatico(text) from public,anon,authenticated;
grant execute on function public.hh_enfileirar_envio_automatico() to service_role;
grant execute on function public.hh_claim_envio_automatico(uuid,text) to service_role;
grant execute on function public.hh_retomar_envio_automatico(text,text) to service_role;
grant execute on function public.hh_envio_automatico_manual(text) to service_role;
grant execute on function public.hh_sincronizar_envio_automatico(text) to service_role;
notify pgrst,'reload schema';
commit;
