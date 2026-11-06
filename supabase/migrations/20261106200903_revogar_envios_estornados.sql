begin;
set local lock_timeout='5s';
-- Revoga workers que estavam em uma chamada externa quando ocorreu um estorno.
-- Eles não podem sobrescrever a pausa financeira nem finalizar a expedição.
create function public.hh_revogar_envio_financeiro() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if coalesce((new.pagamento->>'requer_revisao')::boolean,false) or new.pagamento->>'status' in ('refunded','charged_back','in_mediation')
 or coalesce((new.pagamento->>'valor_reembolsado')::numeric,0)>0 then
  update public.pedido_envios set lease_id=null,locked_until=null,
   estado=case when estado='pronta' then estado else 'bloqueada' end,
   erro='Pagamento em revisao financeira. Nao postar.' where pedido_id=new.id;
  update public.envio_automatico_fila set lease_id=null,locked_until=null,estado='atencao',
   mensagem='Pagamento estornado, contestado ou parcialmente devolvido. Conferencia manual obrigatoria.' where pedido_id=new.id and estado<>'concluida';
 end if;return new;
end $$;
create trigger hh_revogar_envio_financeiro after update of pagamento on public.pedidos for each row execute function public.hh_revogar_envio_financeiro();
revoke all on function public.hh_revogar_envio_financeiro() from public,anon,authenticated;
grant execute on function public.hh_revogar_envio_financeiro() to service_role;
notify pgrst,'reload schema';
commit;
