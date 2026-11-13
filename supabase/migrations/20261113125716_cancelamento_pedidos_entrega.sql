BEGIN;
SET LOCAL lock_timeout='5s';

-- Fila privada: nenhum erro de navegação inicia um reembolso. É necessário
-- um cancelamento explícito, autenticado e validado contra o pedido original.
CREATE TABLE public.pedido_cancelamentos (
  pedido_id text PRIMARY KEY,
  estado text NOT NULL DEFAULT 'reembolso_pendente' CHECK(estado IN ('reembolso_pendente','cancelado')),
  motivo text NOT NULL CHECK(char_length(motivo) BETWEEN 3 AND 500),
  origem text NOT NULL CHECK(origem IN ('cliente','admin')),
  solicitante_id text NOT NULL,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  reembolsado_em timestamptz,
  pagamento_id text,
  valor numeric NOT NULL CHECK(valor>=0),
  reembolso_chave uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_id uuid, locked_until timestamptz,
  proxima_tentativa timestamptz NOT NULL DEFAULT now(),
  tentativas integer NOT NULL DEFAULT 0,
  erro text
);
CREATE INDEX pedido_cancelamentos_pendentes_idx ON public.pedido_cancelamentos(proxima_tentativa) WHERE estado='reembolso_pendente';
ALTER TABLE public.pedidos ADD COLUMN estoque_reposto_cancelamento_em timestamptz;
ALTER TABLE public.pedido_notificacoes DROP CONSTRAINT pedido_notificacoes_evento_check;
ALTER TABLE public.pedido_notificacoes ADD CONSTRAINT pedido_notificacoes_evento_check CHECK(evento IN (
  'novo_pedido','pagamento_aprovado','enviado','entregue','retirada_disponivel','retirada_lembrete',
  'retirada_cancelamento','retirada_reembolsada','retirada_atencao','cancelamento_solicitado','cancelamento_reembolsado','cancelamento_atencao'));

CREATE FUNCTION public.hh_pode_cancelar_entrega(p public.pedidos,p_admin boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(p.entrega->>'modalidade','')<>'retirada'
    AND (p.status IN ('pago','confirmado','processando') OR (p_admin AND p.status='pagamento_em_analise'))
    AND coalesce(p.codigo_rastreio,'')=''
    AND (p.total=0 OR (p.total>0 AND p.mp_payment_id~'^\d+$' AND p.pagamento->>'status'='approved'
      AND coalesce((p.pagamento->>'valor_reembolsado')::numeric,0)=0))
    AND (p_admin OR NOT coalesce((p.pagamento->>'requer_revisao')::boolean,false))
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(p.itens,'[]')) i WHERE nullif(i->>'data_recebimento','') IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM public.pedido_envios e WHERE e.pedido_id=p.id AND
      (e.me_id IS NOT NULL OR e.etiqueta_gerada OR e.estado NOT IN ('nova','bloqueada') OR e.locked_until>now()))
    AND NOT EXISTS(SELECT 1 FROM public.envio_automatico_fila f WHERE f.pedido_id=p.id AND f.locked_until>now())
    AND NOT EXISTS(SELECT 1 FROM public.trocas t WHERE t.pedido_id=p.id::text AND t.status<>'recusado');
$$;

CREATE FUNCTION public.hh_notificar_cancelamento(p public.pedidos,c public.pedido_cancelamentos,p_evento text,p_destino text DEFAULT 'cliente') RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  INSERT INTO public.pedido_notificacoes(pedido_id,evento,destinatario,payload)
  VALUES(c.pedido_id,p_evento,p_destino,jsonb_build_object('id',c.pedido_id,'cliente_email',p.cliente_email,'cliente_nome',p.cliente_nome,
    'total',p.total,'status',p.status,'itens',p.itens,'cancelamento',jsonb_build_object('estado',c.estado,'motivo',c.motivo,'solicitado_em',c.solicitado_em,'reembolsado_em',c.reembolsado_em)))
  ON CONFLICT(pedido_id,evento,destinatario) DO NOTHING;
END $$;

CREATE FUNCTION public.hh_solicitar_cancelamento_entrega(p_pedido_id text,p_email text,p_admin boolean,p_solicitante text,p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; c public.pedido_cancelamentos;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id::text=p_pedido_id FOR UPDATE;
  IF p.id IS NULL OR p_admin IS NULL OR (NOT p_admin AND p.cliente_email IS DISTINCT FROM p_email) THEN RAISE EXCEPTION 'Pedido nao encontrado'; END IF;
  IF nullif(trim(p_solicitante),'') IS NULL OR char_length(trim(p_motivo)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  IF EXISTS(SELECT 1 FROM public.pedido_cancelamentos WHERE pedido_id=p_pedido_id) THEN RETURN; END IF;
  -- Mesma ordem de locks do gerador de etiquetas. Um worker já em operação
  -- bloqueia o cancelamento até a conciliação do envio, mesmo após timeout.
  PERFORM 1 FROM public.pedido_envios WHERE pedido_id=p.id FOR UPDATE;
  PERFORM 1 FROM public.envio_automatico_fila WHERE pedido_id=p.id FOR UPDATE;
  IF public.hh_pode_cancelar_entrega(p,p_admin) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cancelamento indisponivel. Confira pagamento, etiqueta, envio e eventuais devolucoes';
  END IF;
  INSERT INTO public.pedido_cancelamentos(pedido_id,motivo,origem,solicitante_id,pagamento_id,valor)
    VALUES(p_pedido_id,trim(p_motivo),CASE WHEN p_admin THEN 'admin' ELSE 'cliente' END,p_solicitante,p.mp_payment_id,p.total) RETURNING * INTO c;
  UPDATE public.pedidos SET status='cancelamento_pendente' WHERE id=p.id RETURNING * INTO p;
  UPDATE public.pedido_envios SET estado='bloqueada',lease_id=NULL,locked_until=NULL,erro='Pedido cancelado. Nao postar.' WHERE pedido_id=p.id;
  UPDATE public.envio_automatico_fila SET estado='manual',lease_id=NULL,locked_until=NULL,
    mensagem='Pedido cancelado. Nao preparar nem enviar. Reembolso em acompanhamento.',atualizado_em=now() WHERE pedido_id=p.id;
  PERFORM public.hh_notificar_cancelamento(p,c,'cancelamento_solicitado');
END $$;

-- O resumo é usado pelas APIs autenticadas. Chaves de idempotência, IDs de
-- pagamento e leases permanecem exclusivamente no servidor.
CREATE FUNCTION public.hh_resumo_cancelamentos(p_ids text[],p_admin boolean DEFAULT false) RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('pedido_id',p.id::text,'pode_cancelar',c.pedido_id IS NULL AND coalesce(public.hh_pode_cancelar_entrega(p,p_admin),false),
    'cancelamento',CASE WHEN c.pedido_id IS NULL THEN NULL ELSE jsonb_build_object('estado',c.estado,'motivo',c.motivo,
      'solicitado_em',c.solicitado_em,'reembolsado_em',c.reembolsado_em,'erro',CASE WHEN p_admin THEN c.erro ELSE NULL END) END)
  FROM public.pedidos p LEFT JOIN public.pedido_cancelamentos c ON c.pedido_id=p.id::text
  WHERE p.id::text=ANY(p_ids);
$$;

CREATE FUNCTION public.hh_claim_cancelamentos(p_pedido_id text DEFAULT NULL,p_limite integer DEFAULT 3) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; c public.pedido_cancelamentos;
BEGIN
  FOR p IN SELECT ped.* FROM public.pedidos ped JOIN public.pedido_cancelamentos pc ON pc.pedido_id=ped.id::text
    WHERE pc.estado='reembolso_pendente' AND (p_pedido_id IS NULL OR pc.pedido_id=p_pedido_id) AND pc.proxima_tentativa<=now()
    AND (pc.locked_until IS NULL OR pc.locked_until<now()) ORDER BY pc.proxima_tentativa LIMIT least(greatest(p_limite,1),10) FOR UPDATE OF ped SKIP LOCKED LOOP
    UPDATE public.pedido_cancelamentos SET lease_id=gen_random_uuid(),locked_until=now()+interval '5 minutes',tentativas=tentativas+1
      WHERE pedido_id=p.id::text AND estado='reembolso_pendente' AND proxima_tentativa<=now()
      AND (locked_until IS NULL OR locked_until<now()) RETURNING * INTO c;
    IF NOT FOUND THEN CONTINUE; END IF;
    RETURN NEXT jsonb_build_object('pedido',to_jsonb(p),'cancelamento',to_jsonb(c));
  END LOOP;
END $$;

CREATE FUNCTION public.hh_concluir_cancelamento_entrega(p_pedido_id text,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; c public.pedido_cancelamentos; item record; credito numeric;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id::text=p_pedido_id FOR UPDATE;
  SELECT * INTO c FROM public.pedido_cancelamentos WHERE pedido_id=p_pedido_id FOR UPDATE;
  IF p.id IS NULL OR c.pedido_id IS NULL OR p_lease IS NULL THEN RAISE EXCEPTION 'Cancelamento nao encontrado'; END IF;
  IF c.estado='cancelado' THEN RETURN true; END IF;
  IF c.lease_id IS DISTINCT FROM p_lease OR c.locked_until IS NULL OR c.locked_until<=now()
    OR p.status IN ('enviado','entregue') OR p.total IS DISTINCT FROM c.valor OR p.mp_payment_id IS DISTINCT FROM c.pagamento_id THEN RAISE EXCEPTION 'Reserva ou pagamento do cancelamento incompativel'; END IF;
  IF p.total>0 AND (p.pagamento->>'status' IS DISTINCT FROM 'refunded'
    OR round(coalesce((p.pagamento->>'valor_reembolsado')::numeric,0),2)<>round(p.total,2)) THEN RAISE EXCEPTION 'Reembolso integral ainda nao confirmado'; END IF;
  PERFORM 1 FROM public.usuarios WHERE email=p.cliente_email FOR UPDATE;
  IF p.estoque_baixado_em IS NOT NULL AND p.estoque_reposto_cancelamento_em IS NULL THEN
    FOR item IN SELECT produto_id,sum(quantidade)::int qtd FROM public.pedido_itens WHERE pedido_id=p.id GROUP BY produto_id ORDER BY produto_id LOOP
      UPDATE public.produtos SET estoque=estoque+item.qtd WHERE id=item.produto_id;
    END LOOP;
    UPDATE public.pedidos SET estoque_reposto_cancelamento_em=now() WHERE id=p.id;
  END IF;
  IF p.cashback_debitado>0 AND p.cashback_estornado_em IS NULL THEN
    UPDATE public.usuarios SET saldo_cashback=coalesce(saldo_cashback,0)+p.cashback_debitado WHERE email=p.cliente_email;
    UPDATE public.pedidos SET cashback_estornado_em=now() WHERE id=p.id;
  END IF;
  credito:=CASE WHEN p.cashback_creditado_em IS NOT NULL THEN greatest(0,round(p.total*0.05,2)-p.cashback_revertido) ELSE 0 END;
  IF credito>0 THEN UPDATE public.usuarios SET saldo_cashback=coalesce(saldo_cashback,0)-credito WHERE email=p.cliente_email; END IF;
  UPDATE public.pedido_cancelamentos SET estado='cancelado',reembolsado_em=now(),erro=NULL,lease_id=NULL,locked_until=NULL WHERE pedido_id=p_pedido_id RETURNING * INTO c;
  UPDATE public.pedidos SET status='cancelado',cashback_revertido=cashback_revertido+credito WHERE id=p.id RETURNING * INTO p;
  PERFORM public.hh_notificar_cancelamento(p,c,'cancelamento_reembolsado');
  RETURN true;
END $$;

CREATE FUNCTION public.hh_falha_cancelamento_entrega(p_pedido_id text,p_lease uuid,p_erro text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; c public.pedido_cancelamentos;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id::text=p_pedido_id FOR UPDATE;
  UPDATE public.pedido_cancelamentos SET erro=left(p_erro,500),lease_id=NULL,locked_until=NULL,
    proxima_tentativa=now()+make_interval(secs=>least(86400,3600*power(2,least(tentativas-1,4)))::integer)
    WHERE pedido_id=p_pedido_id AND lease_id=p_lease AND estado='reembolso_pendente' RETURNING * INTO c;
  IF FOUND THEN PERFORM public.hh_notificar_cancelamento(p,c,'cancelamento_atencao','admin'); END IF;
END $$;

CREATE FUNCTION public.hh_retomar_cancelamento_entrega(p_pedido_id text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.pedidos WHERE id::text=p_pedido_id FOR UPDATE;
  UPDATE public.pedido_cancelamentos SET proxima_tentativa=now() WHERE pedido_id=p_pedido_id AND estado='reembolso_pendente'
    AND (locked_until IS NULL OR locked_until<now());
  IF NOT FOUND THEN RAISE EXCEPTION 'Cancelamento ja concluido ou em processamento'; END IF;
END $$;

CREATE FUNCTION public.hh_proteger_cancelamento_entrega() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE estado text;
BEGIN
  SELECT c.estado INTO estado FROM public.pedido_cancelamentos c WHERE c.pedido_id=NEW.id::text;
  IF estado IS NOT NULL THEN
    IF NEW.status IN ('processando','enviado','entregue') OR NEW.codigo_rastreio IS DISTINCT FROM OLD.codigo_rastreio
      OR NEW.itens IS DISTINCT FROM OLD.itens OR NEW.entrega IS DISTINCT FROM OLD.entrega THEN RAISE EXCEPTION 'Pedido cancelado nao pode ser preparado ou enviado'; END IF;
    NEW.status:=CASE WHEN estado='cancelado' THEN 'cancelado' ELSE 'cancelamento_pendente' END;
  END IF;
  RETURN NEW;
END $$;
-- Executa antes do controle de estoque, inclusive quando um webhook atrasado tenta confirmar o pedido.
CREATE TRIGGER hh_00_proteger_cancelamento BEFORE UPDATE OF status,pagamento,codigo_rastreio,itens,entrega ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.hh_proteger_cancelamento_entrega();

CREATE FUNCTION public.hh_bloquear_envio_cancelado() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.pedidos WHERE id=NEW.pedido_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.pedido_cancelamentos WHERE pedido_id=NEW.pedido_id::text) THEN
    -- A revisão financeira apenas revoga o worker; não autoriza operação externa.
    IF TG_OP='UPDATE' AND NEW.lease_id IS NULL AND NEW.me_id IS NOT DISTINCT FROM OLD.me_id
      AND NEW.etiqueta_gerada IS NOT DISTINCT FROM OLD.etiqueta_gerada AND NEW.estado='bloqueada' THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Pedido cancelado nao pode gerar etiqueta';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hh_bloquear_envio_cancelado BEFORE INSERT OR UPDATE ON public.pedido_envios FOR EACH ROW EXECUTE FUNCTION public.hh_bloquear_envio_cancelado();

ALTER TABLE public.pedido_cancelamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_cancelamentos FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.pedido_cancelamentos TO service_role;
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure assinatura FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
    ('hh_pode_cancelar_entrega','hh_notificar_cancelamento','hh_solicitar_cancelamento_entrega','hh_resumo_cancelamentos','hh_claim_cancelamentos',
     'hh_concluir_cancelamento_entrega','hh_falha_cancelamento_entrega','hh_retomar_cancelamento_entrega','hh_proteger_cancelamento_entrega','hh_bloquear_envio_cancelado') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.assinatura);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.assinatura);
  END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
