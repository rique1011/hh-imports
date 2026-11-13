BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.pedidos ADD COLUMN beneficio_primeira_compra boolean NOT NULL DEFAULT false;
CREATE INDEX pedidos_beneficio_cliente_idx ON public.pedidos(cliente_email) WHERE beneficio_primeira_compra;

-- A validação de desconto no HTTP não é uma reserva. Todos os checkouts do
-- mesmo cliente disputam o mesmo lock usado para saldo, estoque e idempotência.
CREATE OR REPLACE FUNCTION public.hh_checkout_com_resumo(p_email text,p_nome text,p_total numeric,p_itens jsonb,p_cashback numeric,p_entrega jsonb,p_frete jsonb,p_chave uuid,p_hash text,p_resumo jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE resultado jsonb; u public.usuarios; primeira boolean;
BEGIN
  IF jsonb_typeof(p_resumo) IS DISTINCT FROM 'object' OR (p_resumo->>'total')::numeric IS DISTINCT FROM p_total THEN RAISE EXCEPTION 'Resumo financeiro invalido'; END IF;
  primeira:=coalesce((p_resumo->>'primeira_compra')::boolean,false);
  SELECT * INTO u FROM public.usuarios WHERE email=p_email AND NOT bloqueado FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario indisponivel'; END IF;
  IF primeira AND NOT EXISTS(SELECT 1 FROM public.pedidos WHERE cliente_email=p_email AND checkout_chave=p_chave) THEN
    IF u.created_at IS NULL OR u.created_at>now() OR u.created_at<now()-interval '7 days'
      OR EXISTS(SELECT 1 FROM public.pedidos WHERE cliente_email=p_email AND
        (lower(status) IN ('pago','confirmado','processando','enviado','entregue')
          OR (beneficio_primeira_compra AND lower(status)<>'cancelado'))) THEN
      RAISE EXCEPTION 'Beneficio de primeira compra ja reservado ou indisponivel. Retome o pedido existente';
    END IF;
  END IF;
  resultado:=public.hh_checkout_seguro(p_email,p_nome,p_total,p_itens,p_cashback,p_entrega,p_frete,p_chave,p_hash);
  UPDATE public.pedidos SET resumo_compra=coalesce(resumo_compra,p_resumo),
    beneficio_primeira_compra=beneficio_primeira_compra OR primeira
    WHERE id::text=resultado->>'id' RETURNING to_jsonb(pedidos.*) INTO resultado;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.hh_checkout_com_resumo(text,text,numeric,jsonb,numeric,jsonb,jsonb,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hh_checkout_com_resumo(text,text,numeric,jsonb,numeric,jsonb,jsonb,uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
