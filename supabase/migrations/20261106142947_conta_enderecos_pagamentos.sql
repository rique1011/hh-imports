begin;
set local lock_timeout = '5s';

alter table public.pedidos add column if not exists pagamento jsonb not null default '{}'::jsonb;
alter table public.pedidos add column if not exists pagamento_expira_em timestamptz;
alter table public.pedidos add column if not exists pagamento_consultado_em timestamptz;
update public.pedidos set pagamento_expira_em=created_at+interval '24 hours' where pagamento_expira_em is null;
alter table public.pedidos alter column pagamento_expira_em set default (now()+interval '24 hours');
create index if not exists pedidos_conciliacao_idx on public.pedidos(pagamento_consultado_em nulls first)
  where lower(status)='pendente';

do $migration$
declare tipo_id text;
begin
  select pg_catalog.format_type(atttypid,atttypmod) into tipo_id from pg_catalog.pg_attribute
    where attrelid='public.usuarios'::regclass and attname='id' and not attisdropped;
  if tipo_id not in ('bigint','uuid') then raise exception 'Tipo de usuario nao suportado'; end if;
  execute pg_catalog.format($ddl$
    create table if not exists public.usuario_enderecos (
      id uuid primary key default gen_random_uuid(),
      usuario_id %s not null references public.usuarios(id) on delete cascade,
      apelido text not null check(length(apelido) between 1 and 60),
      dados jsonb not null check(jsonb_typeof(dados)='object'),
      padrao boolean not null default false,
      criado_em timestamptz not null default now(),
      atualizado_em timestamptz not null default now()
    )
  $ddl$,tipo_id);
end $migration$;
alter table public.usuario_enderecos enable row level security;
revoke all on public.usuario_enderecos from public,anon,authenticated;
grant select,insert,update,delete on public.usuario_enderecos to service_role;
create index if not exists usuario_enderecos_usuario_idx on public.usuario_enderecos(usuario_id,criado_em);
create unique index if not exists usuario_enderecos_padrao_idx on public.usuario_enderecos(usuario_id) where padrao;

-- Importa o endereço atual sem alterar pedidos nem adivinhar dados ausentes.
do $import$
declare u record; endereco jsonb;
begin
  for u in select cadastro.id,cadastro.endereco from public.usuarios cadastro where coalesce(cadastro.endereco,'')<>'' loop
    begin endereco:=u.endereco::jsonb; exception when invalid_text_representation then continue; end;
    if jsonb_typeof(endereco)<>'object' or coalesce(endereco->>'cep','')='' then continue; end if;
    endereco:=jsonb_build_object('cep',regexp_replace(endereco->>'cep','\D','','g'),
      'logradouro',coalesce(endereco->>'logradouro',''),'numero',coalesce(endereco->>'numero',''),
      'complemento',coalesce(endereco->>'complemento',''),'bairro',coalesce(endereco->>'bairro',''),
      'cidade',coalesce(endereco->>'cidade',''),'uf',upper(coalesce(endereco->>'uf','')));
    if not exists(select 1 from public.usuario_enderecos where usuario_id=u.id) then
      insert into public.usuario_enderecos(usuario_id,apelido,dados,padrao) values(u.id,'Principal',endereco,true);
    end if;
  end loop;
end $import$;

create or replace function public.hh_endereco_usuario(
  p_email text,p_acao text,p_id uuid default null,p_dados jsonb default null,p_apelido text default null,p_padrao boolean default false
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare usuario public.usuarios; chave uuid; principal uuid; lista jsonb;
begin
  select * into usuario from public.usuarios where email=p_email for update;
  if not found then raise exception 'Usuario nao encontrado'; end if;
  if p_acao not in ('salvar','excluir','padrao') then raise exception 'Acao invalida'; end if;
  if p_id is not null and not exists(select 1 from public.usuario_enderecos where id=p_id and usuario_id=usuario.id) then
    raise exception 'Endereco nao encontrado';
  end if;
  if p_acao='salvar' then
    if jsonb_typeof(p_dados) is distinct from 'object' or coalesce(p_dados->>'cep','')!~'^\d{8}$'
      or coalesce(p_dados->>'uf','')!~'^[A-Z]{2}$' or length(coalesce(p_dados->>'logradouro',''))<2
      or coalesce(p_dados->>'numero','')='' or coalesce(p_dados->>'bairro','')=''
      or coalesce(p_dados->>'cidade','')='' or length(coalesce(p_apelido,'')) not between 1 and 60 then
      raise exception 'Endereco invalido';
    end if;
    chave:=coalesce(p_id,gen_random_uuid());
    if p_padrao or not exists(select 1 from public.usuario_enderecos where usuario_id=usuario.id and padrao) then
      update public.usuario_enderecos set padrao=false where usuario_id=usuario.id and padrao;
      principal:=chave;
    end if;
    if p_id is null then
      insert into public.usuario_enderecos(id,usuario_id,apelido,dados,padrao)
        values(chave,usuario.id,p_apelido,p_dados,coalesce(principal=chave,false));
    else
      update public.usuario_enderecos set apelido=p_apelido,dados=p_dados,
        padrao=case when principal=chave then true else padrao end,atualizado_em=now() where id=chave and usuario_id=usuario.id;
    end if;
  elsif p_acao='excluir' then
    if p_id is null then raise exception 'Endereco nao informado'; end if;
    delete from public.usuario_enderecos where id=p_id and usuario_id=usuario.id;
  else
    if p_id is null then raise exception 'Endereco nao informado'; end if;
    update public.usuario_enderecos set padrao=false where usuario_id=usuario.id and padrao;
    update public.usuario_enderecos set padrao=true,atualizado_em=now() where id=p_id and usuario_id=usuario.id;
  end if;
  if not exists(select 1 from public.usuario_enderecos where usuario_id=usuario.id and padrao) then
    select id into principal from public.usuario_enderecos where usuario_id=usuario.id order by criado_em,id limit 1;
    update public.usuario_enderecos set padrao=true where id=principal;
  end if;
  update public.usuarios set endereco=(select dados::text from public.usuario_enderecos where usuario_id=usuario.id and padrao)
    where id=usuario.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'apelido',apelido,'padrao',padrao)||dados order by padrao desc,criado_em,id),'[]')
    into lista from public.usuario_enderecos where usuario_id=usuario.id;
  return lista;
end $$;

create or replace function public.hh_registrar_preferencia(p_pedido_id text,p_email text,p_preferencia text,p_novo boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare pedido public.pedidos;
begin
  select * into pedido from public.pedidos where id::text=p_pedido_id and cliente_email=p_email for update;
  if not found or lower(pedido.status)<>'pendente' or pedido.pagamento_expira_em<=now() or coalesce(p_preferencia,'')='' then
    raise exception 'Pedido indisponivel para pagamento';
  end if;
  update public.pedidos set pagamento=pagamento||jsonb_build_object('preferencia_id',p_preferencia)
    ||case when p_novo then '{"preferencia_com_prazo":true}'::jsonb else '{}'::jsonb end where id=pedido.id;
end $$;

-- Chamado somente depois de a API do provedor confirmar preferência vencida e ausência de tentativas.
create or replace function public.hh_expirar_pagamento_sem_tentativa(p_pedido_id text,p_consultado_em timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pedido public.pedidos;
begin
  select * into pedido from public.pedidos where id::text=p_pedido_id for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  if lower(pedido.status)<>'pendente' or pedido.mp_payment_id is not null
    or pedido.pagamento_consultado_em is distinct from p_consultado_em
    or pedido.pagamento_expira_em is null or pedido.pagamento_expira_em>now()-interval '10 minutes'
    or pedido.pagamento->>'preferencia_com_prazo' is distinct from 'true'
    or coalesce(pedido.pagamento->>'status','') in ('pending','approved','authorized','in_process') then
    return to_jsonb(pedido);
  end if;
  update public.pedidos set status='cancelado',pagamento=pagamento||jsonb_build_object('expirado_em',now())
    where id=pedido.id returning * into pedido;
  return to_jsonb(pedido);
end $$;

-- A origem dos dados é sempre a consulta autenticada ao provedor no servidor.
-- Aprovação, estoque, cashback e notificações continuam na transação existente.
create or replace function public.hh_sincronizar_pagamento(p_pedido_id text,p_pagamento_id text,p_total numeric,p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pedido public.pedidos; confirmado jsonb;
begin
  select * into pedido from public.pedidos where id::text=p_pedido_id for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  if p_pagamento_id!~'^\d+$' or p_total is null or round(p_total,2)<>round(pedido.total,2)
    or jsonb_typeof(p_dados) is distinct from 'object' or coalesce(p_dados->>'status','')='' then
    raise exception 'Dados de pagamento incompativeis';
  end if;
  if p_dados->>'status'='approved' then
    -- Uma confirmação excepcionalmente tardia nunca gera expedição com estoque já liberado.
    if pedido.estoque_liberado_em is not null and pedido.estoque_baixado_em is null and pedido.pagamento ? 'expirado_em' then
      if pedido.mp_payment_id is not null and pedido.mp_payment_id<>p_pagamento_id then raise exception 'Pagamento duplicado requer conciliacao'; end if;
      update public.pedidos set status='pagamento_em_analise',mp_payment_id=p_pagamento_id,
        pagamento=pagamento||p_dados||jsonb_build_object('id',p_pagamento_id,'requer_revisao',true),pagamento_consultado_em=now()
        where id=pedido.id returning to_jsonb(pedidos.*) into confirmado;
      perform public.hh_enqueue_notification(confirmado,'pagamento_aprovado','admin');
      return confirmado;
    end if;
    select public.hh_confirmar_pagamento(p_pedido_id,p_pagamento_id,p_total) into confirmado;
  elsif pedido.pagamento->>'status'='approved' or lower(pedido.status) in ('pago','confirmado','processando','enviado','entregue') then
    return to_jsonb(pedido);
  elsif coalesce(p_dados->>'atualizado_em','')<coalesce(pedido.pagamento->>'atualizado_em','') then
    return to_jsonb(pedido);
  end if;
  update public.pedidos set pagamento=pagamento||p_dados||jsonb_build_object('id',p_pagamento_id),pagamento_consultado_em=now()
    where id=pedido.id returning to_jsonb(pedidos.*) into confirmado;
  return confirmado;
end $$;

revoke all on function public.hh_endereco_usuario(text,text,uuid,jsonb,text,boolean) from public,anon,authenticated;
revoke all on function public.hh_registrar_preferencia(text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.hh_expirar_pagamento_sem_tentativa(text,timestamptz) from public,anon,authenticated;
revoke all on function public.hh_sincronizar_pagamento(text,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.hh_endereco_usuario(text,text,uuid,jsonb,text,boolean) to service_role;
grant execute on function public.hh_registrar_preferencia(text,text,text,boolean) to service_role;
grant execute on function public.hh_expirar_pagamento_sem_tentativa(text,timestamptz) to service_role;
grant execute on function public.hh_sincronizar_pagamento(text,text,numeric,jsonb) to service_role;
notify pgrst,'reload schema';
commit;

