begin;
set local lock_timeout='5s';
-- Dados de autenticação nunca são expostos pela API pública do Supabase.
alter table public.usuarios add column if not exists senha text;
alter table public.usuarios add column if not exists email_verificado boolean default false;
alter table public.usuarios add column if not exists codigo_verificacao text;
alter table public.usuarios add column if not exists recovery_token text;
alter table public.usuarios add column if not exists recovery_token_expires timestamptz;
alter table public.usuarios add column sessao_versao integer not null default 1;
alter table public.usuarios add column senha_politica_versao integer not null default 0;
alter table public.usuarios add column bloqueado boolean not null default false;
alter table public.usuarios add column verificacao_expires timestamptz;
alter table public.usuarios add column verificacao_tentativas integer not null default 0;
alter table public.usuarios add column mfa_secret text;
alter table public.usuarios add column mfa_pendente text;
alter table public.usuarios add column mfa_pendente_expires timestamptz;
alter table public.usuarios add column mfa_ultimo_passo bigint not null default -1;
alter table public.usuarios add column mfa_recuperacao text[] not null default '{}';
-- Tokens anteriores não têm a proteção de uso único desta versão.
update public.usuarios set email=lower(btrim(email)),codigo_verificacao=null,recovery_token=null,recovery_token_expires=null;
create unique index usuarios_email_seguro_idx on public.usuarios(email);
create unique index usuarios_email_normalizado_idx on public.usuarios(lower(btrim(email)));

create table public.seguranca_limites(chave text primary key check(length(chave)=64),quantidade integer not null,expira_em timestamptz not null);
create index seguranca_limites_expira_idx on public.seguranca_limites(expira_em);
create table public.seguranca_tarefas(chave text primary key,estado text not null default 'pendente',atualizado_em timestamptz not null default now());
insert into public.seguranca_tarefas(chave) values('fotos_devolucoes_privadas');
create or replace function public.hh_claim_migracao_fotos() returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.seguranca_tarefas set estado='executando',atualizado_em=now() where chave='fotos_devolucoes_privadas'
 and (estado='pendente' or (estado='executando' and atualizado_em<now()-interval '3 minutes'));
 return found;
end $$;
create or replace function public.hh_limitar(p_chave text,p_limite integer,p_segundos integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_limite not between 1 and 1000 or p_segundos not between 1 and 86400 then raise exception 'Limite invalido'; end if;
 delete from public.seguranca_limites where chave in (select chave from public.seguranca_limites where expira_em<now() limit 100);
 insert into public.seguranca_limites values(p_chave,1,now()+p_segundos*interval '1 second')
 on conflict(chave) do update set quantidade=case when seguranca_limites.expira_em<=now() then 1 else seguranca_limites.quantidade+1 end,
 expira_em=case when seguranca_limites.expira_em<=now() then excluded.expira_em else seguranca_limites.expira_em end returning quantidade into n;
 return n<=p_limite;
end $$;
create or replace function public.hh_cadastrar(p_email text,p_nome text,p_senha text,p_codigo text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email,0));
 if exists(select 1 from public.usuarios where email=p_email and email_verificado) then return false; end if;
 -- O código enviado somente ao dono do e-mail autoriza concluir o cadastro pendente.
 insert into public.usuarios(email,nome,senha,codigo_verificacao,email_verificado,verificacao_expires,senha_politica_versao)
 values(p_email,p_nome,p_senha,p_codigo,false,now()+interval '15 minutes',1)
 on conflict (email) do update set nome=excluded.nome,senha=excluded.senha,codigo_verificacao=excluded.codigo_verificacao,
 verificacao_expires=excluded.verificacao_expires,verificacao_tentativas=0,senha_politica_versao=1,sessao_versao=usuarios.sessao_versao+1 where not usuarios.email_verificado;
 return true;
end $$;
create or replace function public.hh_verificar_email(p_email text,p_codigo text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare u public.usuarios;
begin
 select * into u from public.usuarios where email=p_email for update;
 if not found or u.email_verificado or u.verificacao_expires is null or u.verificacao_expires<=now() or u.verificacao_tentativas>=5 then return false; end if;
 if u.codigo_verificacao is distinct from p_codigo then
  update public.usuarios set verificacao_tentativas=verificacao_tentativas+1 where id=u.id; return false;
 end if;
 update public.usuarios set email_verificado=true,codigo_verificacao=null,verificacao_expires=null where id=u.id;
 return true;
end $$;
create or replace function public.hh_redefinir_senha(p_token text,p_senha text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update public.usuarios set senha=p_senha,recovery_token=null,recovery_token_expires=null,sessao_versao=sessao_versao+1,senha_politica_versao=1
 where recovery_token=p_token and recovery_token_expires>now() and not bloqueado;
 return found;
end $$;
create or replace function public.hh_consumir_mfa(p_id text,p_secret text,p_passo bigint,p_recuperacao text default null) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_recuperacao is not null then
  update public.usuarios set mfa_recuperacao=array_remove(mfa_recuperacao,p_recuperacao)
   where id::text=p_id and mfa_secret=p_secret and p_recuperacao=any(mfa_recuperacao) and not bloqueado;
 else
  update public.usuarios set mfa_ultimo_passo=p_passo where id::text=p_id and mfa_secret=p_secret and mfa_ultimo_passo<p_passo and not bloqueado;
 end if;
 return found;
end $$;
-- Alterar credenciais, papel, bloqueio ou MFA revoga inclusive JWTs já emitidos.
create or replace function public.hh_revogar_sessoes() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.senha is distinct from old.senha or new.perfil is distinct from old.perfil or new.role is distinct from old.role
 or new.bloqueado is distinct from old.bloqueado or new.mfa_secret is distinct from old.mfa_secret or new.email is distinct from old.email then
  new.sessao_versao:=greatest(new.sessao_versao,old.sessao_versao+1);
 end if; return new;
end $$;
create trigger hh_revogar_sessoes before update on public.usuarios for each row execute function public.hh_revogar_sessoes();

alter table public.pedidos add column checkout_chave uuid;
alter table public.pedidos add column checkout_hash text;
alter table public.pedidos add column cashback_revertido numeric not null default 0;
create unique index pedidos_checkout_idx on public.pedidos(cliente_email,checkout_chave) where checkout_chave is not null;
create or replace function public.hh_checkout_seguro(p_email text,p_nome text,p_total numeric,p_itens jsonb,p_cashback numeric,p_entrega jsonb,p_frete jsonb,p_chave uuid,p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pedido public.pedidos; resultado jsonb;
begin
 perform 1 from public.usuarios where email=p_email and not bloqueado for update;
 if not found then raise exception 'Usuario indisponivel'; end if;
 select * into pedido from public.pedidos where cliente_email=p_email and checkout_chave=p_chave;
 if found then
  if pedido.checkout_hash<>p_hash then raise exception 'Chave reutilizada com outra compra'; end if;
  return to_jsonb(pedido);
 end if;
 if (select count(*) from public.pedidos where cliente_email=p_email and lower(status)='pendente' and estoque_liberado_em is null)>=3 then
  raise exception 'Voce ja tem tres pedidos aguardando pagamento. Retome um pedido existente.';
 end if;
 resultado:=public.hh_criar_pedido_com_envio(p_email,p_nome,p_total,p_itens,p_cashback,p_entrega,p_frete);
 update public.pedidos set checkout_chave=p_chave,checkout_hash=p_hash,pagamento=pagamento||'{"preferencia_com_prazo":true,"checkout_seguro":true}'::jsonb
 where id::text=resultado->>'id' returning to_jsonb(pedidos.*) into resultado;
 return resultado;
end $$;
-- Sem preferência: após a janela de pagamento e uma busca autenticada sem tentativas,
-- o fluxo novo também libera a reserva. Pedidos legados continuam exigindo conciliação.
create or replace function public.hh_expirar_pagamento_sem_tentativa(p_pedido_id text,p_consultado_em timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pedido public.pedidos;
begin
 select * into pedido from public.pedidos where id::text=p_pedido_id for update;
 if not found then raise exception 'Pedido nao encontrado'; end if;
 if lower(pedido.status)<>'pendente' or pedido.mp_payment_id is not null or pedido.pagamento_consultado_em is distinct from p_consultado_em
 or pedido.pagamento_expira_em>now()-interval '10 minutes' or pedido.pagamento->>'preferencia_com_prazo' is distinct from 'true'
 or coalesce(pedido.pagamento->>'status','') in ('pending','approved','authorized','in_process') then return to_jsonb(pedido); end if;
 if coalesce(pedido.pagamento->>'preferencia_id','')='' and pedido.pagamento->>'checkout_seguro' is distinct from 'true' then return to_jsonb(pedido); end if;
 update public.pedidos set status='cancelado',pagamento=pagamento||jsonb_build_object('expirado_em',now()) where id=pedido.id returning * into pedido;
 return to_jsonb(pedido);
end $$;
-- Protege a transição que precede o checkout da etiqueta, inclusive contra workers antigos.
create or replace function public.hh_validar_compra_etiqueta() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.pedidos;
begin
 if new.estado in ('inserindo','comprando') then
 select * into p from public.pedidos where id=new.pedido_id for share;
 if lower(p.status) not in ('pago','confirmado','processando','enviado','entregue') or coalesce((p.pagamento->>'requer_revisao')::boolean,false)
 or p.pagamento->>'status' in ('refunded','charged_back','in_mediation') or coalesce((p.pagamento->>'valor_reembolsado')::numeric,0)>0 then raise exception 'Pagamento em revisao financeira'; end if;
 end if;return new;
end $$;
create trigger hh_validar_compra_etiqueta before insert or update of estado on public.pedido_envios for each row execute function public.hh_validar_compra_etiqueta();
create or replace function public.hh_sincronizar_pagamento(p_pedido_id text,p_pagamento_id text,p_total numeric,p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pedido public.pedidos; confirmado jsonb; problema boolean; reembolsado numeric; credito numeric; alvo numeric;
begin
 select * into pedido from public.pedidos where id::text=p_pedido_id for update;
 if not found then raise exception 'Pedido nao encontrado'; end if;
 if p_pagamento_id!~'^\d+$' or p_total is null or round(p_total,2)<>round(pedido.total,2) or jsonb_typeof(p_dados) is distinct from 'object'
 or coalesce(p_dados->>'status','') not in ('approved','pending','authorized','in_process','rejected','cancelled','refunded','charged_back','in_mediation') then raise exception 'Dados de pagamento incompativeis'; end if;
 if pedido.mp_payment_id is not null and pedido.mp_payment_id<>p_pagamento_id and (pedido.estoque_baixado_em is not null or coalesce(pedido.pagamento->>'status','') not in ('rejected','cancelled')) then raise exception 'Outro pagamento exige conciliacao'; end if;
 if coalesce(p_dados->>'atualizado_em','')<coalesce(pedido.pagamento->>'atualizado_em','') then return to_jsonb(pedido); end if;
 -- Não aceitar regressão para pendente de um pagamento já confirmado/estornado.
 if (pedido.pagamento->>'status' in ('refunded','charged_back') and p_dados->>'status' not in ('refunded','charged_back'))
 or (pedido.estoque_baixado_em is not null and p_dados->>'status' in ('pending','authorized','in_process','rejected','cancelled')) then return to_jsonb(pedido); end if;
 reembolsado:=greatest(0,least(p_total,coalesce((p_dados->>'valor_reembolsado')::numeric,0)));
 problema:=p_dados->>'status' in ('refunded','charged_back','in_mediation') or reembolsado>0;
 if p_dados->>'status'='approved' and not problema then
  if pedido.estoque_liberado_em is not null and pedido.estoque_baixado_em is null then
   update public.pedidos set status='pagamento_em_analise',mp_payment_id=p_pagamento_id,
    pagamento=pagamento||p_dados||jsonb_build_object('id',p_pagamento_id,'requer_revisao',true),pagamento_consultado_em=now() where id=pedido.id returning to_jsonb(pedidos.*) into confirmado;
   perform public.hh_enqueue_notification(confirmado,'pagamento_aprovado','admin');
   return confirmado;
  end if;
  confirmado:=public.hh_confirmar_pagamento(p_pedido_id,p_pagamento_id,p_total);
 end if;
 if problema then
  credito:=case when pedido.cashback_creditado_em is not null then round(pedido.total*0.05,2) else 0 end;
  alvo:=case when p_dados->>'status' in ('refunded','charged_back') then credito when p_total>0 then round(credito*reembolsado/p_total,2) else 0 end;
  alvo:=greatest(alvo,pedido.cashback_revertido);
  if alvo>pedido.cashback_revertido then
   update public.usuarios set saldo_cashback=coalesce(saldo_cashback,0)-(alvo-pedido.cashback_revertido) where email=pedido.cliente_email;
  end if;
  update public.pedidos set cashback_revertido=alvo,
   status=case when lower(status) in ('enviado','entregue') then status else 'pagamento_em_analise' end where id=pedido.id;
  update public.envio_automatico_fila set estado='atencao',mensagem='Pagamento estornado, contestado ou parcialmente devolvido. Conferencia manual obrigatoria.',locked_until=null,lease_id=null
   where pedido_id=pedido.id and estado<>'concluida';
  update public.pedido_envios set estado='bloqueada',erro='Pagamento em revisao financeira. Nao postar.' where pedido_id=pedido.id and estado<>'pronta';
 end if;
 update public.pedidos set pagamento=pagamento||p_dados||jsonb_build_object('id',p_pagamento_id,'requer_revisao',problema),
  mp_payment_id=p_pagamento_id,pagamento_consultado_em=now() where id=pedido.id returning to_jsonb(pedidos.*) into confirmado;
 return confirmado;
end $$;

create table public.devolucao_uploads(caminho text primary key,usuario_id text not null,pedido_id text not null,produto_id text not null,criado_em timestamptz not null default now());
create or replace function public.hh_reservar_upload(p_caminho text,p_usuario text,p_pedido text,p_produto text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.usuarios where id::text=p_usuario for update;
 if not found or (select count(*) from public.devolucao_uploads where usuario_id=p_usuario and pedido_id=p_pedido and produto_id=p_produto)>=3 then raise exception 'Limite de fotos'; end if;
 insert into public.devolucao_uploads values(p_caminho,p_usuario,p_pedido,p_produto,now());
end $$;
-- Avaliações históricas continuam visíveis; as novas têm comprador e unicidade.
alter table public.avaliacoes add column if not exists comprador_id text;
create unique index avaliacoes_comprador_produto_idx on public.avaliacoes(comprador_id,produto_id) where comprador_id is not null;
create or replace function public.hh_avaliar(p_usuario text,p_email text,p_produto text,p_nota integer,p_comentario text,p_nome text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_nota not between 1 and 5 or length(p_comentario) not between 1 and 3000 or not exists(
 select 1 from public.pedidos p join public.pedido_itens i on i.pedido_id=p.id where p.cliente_email=p_email and lower(p.status)='entregue'
 and i.produto_referencia=p_produto and not coalesce((p.pagamento->>'requer_revisao')::boolean,false)) then raise exception 'Avaliacao exige compra entregue'; end if;
 insert into public.avaliacoes(produto_id,nota,comentario,usuario_nome,comprador_id) values(p_produto::uuid,p_nota,p_comentario,p_nome,p_usuario);
end $$;
-- Tabelas de controle acessíveis exclusivamente ao backend.
do $$ declare t text; f record; begin
 foreach t in array array['seguranca_limites','seguranca_tarefas','devolucao_uploads'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select oid::regprocedure as assinatura from pg_proc where pronamespace='public'::regnamespace and proname in
 ('hh_validar_compra_etiqueta','hh_claim_migracao_fotos','hh_reservar_upload','hh_limitar','hh_cadastrar','hh_verificar_email','hh_redefinir_senha','hh_consumir_mfa','hh_revogar_sessoes','hh_checkout_seguro','hh_expirar_pagamento_sem_tentativa','hh_sincronizar_pagamento','hh_avaliar') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.assinatura);
 execute format('grant execute on function %s to service_role',f.assinatura);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
