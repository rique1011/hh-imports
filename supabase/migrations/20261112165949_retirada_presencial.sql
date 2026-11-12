BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.loja_retirada (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  ativa boolean NOT NULL DEFAULT false,
  local text NOT NULL DEFAULT 'H&H IMPORTS — Joinville/SC' CHECK(char_length(local) BETWEEN 3 AND 120),
  endereco jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(endereco)='object'),
  instrucoes text NOT NULL DEFAULT 'Retirada mediante agendamento. Aguarde o aviso de disponibilidade e combine o horário pelo WhatsApp da loja.' CHECK(char_length(instrucoes) BETWEEN 3 AND 600),
  prazo_dias integer NOT NULL DEFAULT 30 CHECK(prazo_dias BETWEEN 7 AND 60),
  versao integer NOT NULL DEFAULT 1 CHECK(versao>0)
);
INSERT INTO public.loja_retirada(id) VALUES(true);
CREATE TABLE public.pedido_retiradas (
  pedido_id text PRIMARY KEY,
  estado text NOT NULL DEFAULT 'aguardando_preparo' CHECK(estado IN ('aguardando_preparo','disponivel','retirado','reembolso_pendente','cancelado')),
  config jsonb NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  codigo text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  disponivel_em timestamptz, avisado_em timestamptz, prazo_final timestamptz, lembrete_em timestamptz,
  retirado_em timestamptz, reembolsado_em timestamptz, cancelamento_motivo text,
  reembolso_chave uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_id uuid, locked_until timestamptz, proxima_tentativa timestamptz NOT NULL DEFAULT now(),
  tentativas integer NOT NULL DEFAULT 0, erro text, versao integer NOT NULL DEFAULT 1
);
CREATE INDEX pedido_retiradas_prazos_idx ON public.pedido_retiradas(prazo_final) WHERE estado='disponivel';
CREATE INDEX pedido_retiradas_reembolso_idx ON public.pedido_retiradas(proxima_tentativa) WHERE estado='reembolso_pendente';
ALTER TABLE public.pedidos ADD COLUMN estoque_reposto_retirada_em timestamptz;
ALTER TABLE public.pedido_notificacoes DROP CONSTRAINT pedido_notificacoes_evento_check;
ALTER TABLE public.pedido_notificacoes ADD CONSTRAINT pedido_notificacoes_evento_check CHECK(evento IN ('novo_pedido','pagamento_aprovado','enviado','entregue','retirada_disponivel','retirada_lembrete','retirada_cancelamento','retirada_reembolsada','retirada_atencao'));

CREATE FUNCTION public.hh_notificar_retirada(p public.pedidos,r public.pedido_retiradas,p_evento text,p_destino text DEFAULT 'cliente') RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  INSERT INTO public.pedido_notificacoes(pedido_id,evento,destinatario,payload)
  VALUES(r.pedido_id,p_evento,p_destino,jsonb_build_object('id',r.pedido_id,'cliente_email',p.cliente_email,'cliente_nome',p.cliente_nome,'total',p.total,'status',p.status,'itens',p.itens,
    'retirada',r.config||jsonb_build_object('estado',r.estado,'prazo_final',r.prazo_final,'prazo_dias',r.config->'prazo_dias','codigo',CASE WHEN p_destino='cliente' AND p_evento='retirada_disponivel' THEN r.codigo ELSE NULL END)))
  ON CONFLICT(pedido_id,evento,destinatario) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.hh_enqueue_notification(p_pedido jsonb,p_evento text,p_destinatario text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_destinatario='cliente' AND coalesce(p_pedido->>'cliente_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RETURN; END IF;
  INSERT INTO public.pedido_notificacoes(pedido_id,evento,destinatario,payload)
  VALUES(p_pedido->>'id',p_evento,p_destinatario,jsonb_build_object('id',p_pedido->>'id','cliente_email',p_pedido->>'cliente_email','cliente_nome',coalesce(p_pedido->>'cliente_nome','Cliente'),
    'total',p_pedido->'total','status',p_pedido->>'status','itens',coalesce(p_pedido->'itens','[]'::jsonb),'codigo_rastreio',p_pedido->>'codigo_rastreio','modalidade',p_pedido->'entrega'->>'modalidade'))
  ON CONFLICT(pedido_id,evento,destinatario) DO NOTHING;
END $$;

CREATE FUNCTION public.hh_criar_retirada() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.loja_retirada; snapshot jsonb;
BEGIN
  IF NEW.entrega->>'modalidade'='retirada' AND NOT EXISTS(SELECT 1 FROM public.pedido_retiradas WHERE pedido_id=NEW.id::text) THEN
    SELECT * INTO c FROM public.loja_retirada WHERE id=true;
    snapshot:=to_jsonb(c)-'id';
    IF NOT c.ativa OR NEW.entrega->'retirada' IS DISTINCT FROM snapshot OR NEW.frete_cotacao IS NOT NULL THEN RAISE EXCEPTION 'Configuracao da retirada mudou. Atualize a sacola.'; END IF;
    INSERT INTO public.pedido_retiradas(pedido_id,config) VALUES(NEW.id::text,snapshot);
    -- O pedido pago com créditos pode ter sido enfileirado durante o INSERT anterior.
    DELETE FROM public.envio_automatico_fila WHERE pedido_id=NEW.id;
    UPDATE public.pedido_notificacoes SET payload=payload||jsonb_build_object('modalidade','retirada') WHERE pedido_id=NEW.id::text AND status='pendente';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hh_criar_retirada AFTER UPDATE OF entrega,frete_cotacao ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.hh_criar_retirada();

CREATE FUNCTION public.hh_bloquear_etiqueta_retirada() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.pedidos WHERE id=NEW.pedido_id AND entrega->>'modalidade'='retirada') THEN
    IF TG_TABLE_NAME='envio_automatico_fila' THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'Retirada presencial nao usa etiqueta de transportadora';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hh_bloquear_etiqueta_retirada BEFORE INSERT OR UPDATE ON public.pedido_envios FOR EACH ROW EXECUTE FUNCTION public.hh_bloquear_etiqueta_retirada();
CREATE TRIGGER hh_bloquear_fila_retirada BEFORE INSERT ON public.envio_automatico_fila FOR EACH ROW EXECUTE FUNCTION public.hh_bloquear_etiqueta_retirada();

CREATE FUNCTION public.hh_acao_retirada(p_pedido_id text,p_acao text,p_versao integer,p_codigo text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; r public.pedido_retiradas;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id::text=p_pedido_id FOR UPDATE;
  SELECT * INTO r FROM public.pedido_retiradas WHERE pedido_id=p_pedido_id FOR UPDATE;
  IF p.id IS NULL OR r.pedido_id IS NULL OR r.versao<>p_versao THEN RAISE EXCEPTION 'Pedido alterado. Recarregue antes de continuar'; END IF;
  IF p.status NOT IN ('pago','confirmado','processando') OR coalesce((p.pagamento->>'requer_revisao')::boolean,false)
    OR coalesce(p.pagamento->>'status','approved')<>'approved' OR coalesce((p.pagamento->>'valor_reembolsado')::numeric,0)>0 THEN RAISE EXCEPTION 'A retirada exige pagamento confirmado, sem revisao financeira'; END IF;
  IF p_acao='pronto' AND r.estado='aguardando_preparo' THEN
    UPDATE public.pedido_retiradas SET estado='disponivel',disponivel_em=now(),versao=versao+1 WHERE pedido_id=p_pedido_id RETURNING * INTO r;
    UPDATE public.pedidos SET status='processando',itens=(SELECT jsonb_agg(i||jsonb_build_object('preparacao_iniciada_em',coalesce(nullif(i->'preparacao_iniciada_em','null'::jsonb),to_jsonb(now())))) FROM jsonb_array_elements(itens)i) WHERE id=p.id RETURNING * INTO p;
    PERFORM public.hh_notificar_retirada(p,r,'retirada_disponivel');
  ELSIF p_acao='retirado' AND r.estado='disponivel' THEN
    IF upper(trim(p_codigo))<>r.codigo THEN RAISE EXCEPTION 'Codigo de retirada incorreto'; END IF;
    UPDATE public.pedido_retiradas SET estado='retirado',retirado_em=now(),versao=versao+1 WHERE pedido_id=p_pedido_id RETURNING * INTO r;
    UPDATE public.pedidos SET status='entregue',itens=(SELECT jsonb_agg(i||jsonb_build_object('data_recebimento',to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD'),'recebimento_origem','retirada','recebimento_confirmado_em',now())) FROM jsonb_array_elements(itens)i) WHERE id=p.id;
  ELSIF p_acao='cancelar' AND r.estado IN ('aguardando_preparo','disponivel') THEN
    UPDATE public.pedido_retiradas SET estado='reembolso_pendente',cancelamento_motivo='Solicitado pelo cliente',versao=versao+1 WHERE pedido_id=p_pedido_id RETURNING * INTO r;
    PERFORM public.hh_notificar_retirada(p,r,'retirada_cancelamento');
  ELSE RAISE EXCEPTION 'Acao indisponivel para este pedido'; END IF;
  RETURN to_jsonb(r)-'codigo'-'lease_id'-'reembolso_chave';
END $$;

CREATE FUNCTION public.hh_retirada_aviso_enviado(p_pedido_id text,p_evento text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_evento='retirada_disponivel' THEN
    UPDATE public.pedido_retiradas SET avisado_em=now(),prazo_final=now()+make_interval(days=>(config->>'prazo_dias')::int)
    WHERE pedido_id=p_pedido_id AND estado='disponivel' AND avisado_em IS NULL;
  ELSIF p_evento='retirada_lembrete' THEN
    UPDATE public.pedido_retiradas SET lembrete_em=coalesce(lembrete_em,now()) WHERE pedido_id=p_pedido_id;
  END IF;
END $$;

CREATE FUNCTION public.hh_ack_notificacao_retirada(p_id bigint,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n public.pedido_notificacoes;
BEGIN
  UPDATE public.pedido_notificacoes SET status='enviada',enviada_em=now(),erro=NULL,locked_until=NULL
  WHERE id=p_id AND lease_id=p_lease AND status='processando' AND evento LIKE 'retirada_%' RETURNING * INTO n;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.hh_retirada_aviso_enviado(n.pedido_id,n.evento);
  RETURN true;
END $$;

CREATE FUNCTION public.hh_preparar_prazos_retirada() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; r public.pedido_retiradas; n integer:=0;
BEGIN
  FOR p IN SELECT ped.* FROM public.pedidos ped JOIN public.pedido_retiradas pr ON pr.pedido_id=ped.id::text
    WHERE pr.estado='disponivel' AND pr.prazo_final<=now()+interval '3 days' ORDER BY pr.prazo_final LIMIT 50 FOR UPDATE OF ped SKIP LOCKED LOOP
    SELECT * INTO r FROM public.pedido_retiradas WHERE pedido_id=p.id::text FOR UPDATE;
    IF r.estado<>'disponivel' OR p.status NOT IN ('pago','confirmado','processando') THEN CONTINUE; END IF;
    IF r.lembrete_em IS NULL THEN
      PERFORM public.hh_notificar_retirada(p,r,'retirada_lembrete');
    ELSIF r.prazo_final<=now() AND r.lembrete_em<=now()-interval '24 hours' THEN
      UPDATE public.pedido_retiradas SET estado='reembolso_pendente',cancelamento_motivo='Prazo de retirada encerrado',versao=versao+1 WHERE pedido_id=r.pedido_id RETURNING * INTO r;
      PERFORM public.hh_notificar_retirada(p,r,'retirada_cancelamento'); n:=n+1;
    END IF;
  END LOOP;
  RETURN n;
END $$;

CREATE FUNCTION public.hh_claim_retirada_reembolsos(p_pedido_id text DEFAULT NULL,p_limite integer DEFAULT 3) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; r public.pedido_retiradas;
BEGIN
  FOR p IN SELECT ped.* FROM public.pedidos ped JOIN public.pedido_retiradas pr ON pr.pedido_id=ped.id::text
    WHERE pr.estado='reembolso_pendente' AND (p_pedido_id IS NULL OR pr.pedido_id=p_pedido_id) AND pr.proxima_tentativa<=now()
    AND (pr.locked_until IS NULL OR pr.locked_until<now()) ORDER BY pr.proxima_tentativa LIMIT least(greatest(p_limite,1),10) FOR UPDATE OF ped SKIP LOCKED LOOP
    UPDATE public.pedido_retiradas SET lease_id=gen_random_uuid(),locked_until=now()+interval '5 minutes',tentativas=tentativas+1
      WHERE pedido_id=p.id::text AND estado='reembolso_pendente' AND proxima_tentativa<=now()
        AND (locked_until IS NULL OR locked_until<now()) RETURNING * INTO r;
    IF NOT FOUND THEN CONTINUE; END IF;
    RETURN NEXT jsonb_build_object('pedido',to_jsonb(p),'retirada',to_jsonb(r));
  END LOOP;
END $$;

CREATE FUNCTION public.hh_concluir_reembolso_retirada(p_pedido_id text,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; r public.pedido_retiradas; item record; credito numeric;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id::text=p_pedido_id FOR UPDATE;
  SELECT * INTO r FROM public.pedido_retiradas WHERE pedido_id=p_pedido_id FOR UPDATE;
  IF p.id IS NULL OR r.pedido_id IS NULL OR p_lease IS NULL THEN RAISE EXCEPTION 'Retirada nao encontrada'; END IF;
  IF r.estado='cancelado' THEN RETURN true; END IF;
  IF r.estado<>'reembolso_pendente' OR r.lease_id IS DISTINCT FROM p_lease OR r.locked_until<now() OR p.status IN ('enviado','entregue') THEN RAISE EXCEPTION 'Reserva do cancelamento expirada'; END IF;
  IF p.total>0 AND (p.pagamento->>'status' IS DISTINCT FROM 'refunded' OR coalesce((p.pagamento->>'valor_reembolsado')::numeric,0)<p.total) THEN RAISE EXCEPTION 'Reembolso ainda nao confirmado pelo provedor'; END IF;
  IF p.estoque_baixado_em IS NOT NULL AND p.estoque_reposto_retirada_em IS NULL THEN
    FOR item IN SELECT produto_id,sum(quantidade)::int qtd FROM public.pedido_itens WHERE pedido_id=p.id GROUP BY produto_id ORDER BY produto_id LOOP
      UPDATE public.produtos SET estoque=estoque+item.qtd WHERE id=item.produto_id;
    END LOOP;
    UPDATE public.pedidos SET estoque_reposto_retirada_em=now() WHERE id=p.id;
  END IF;
  IF p.cashback_debitado>0 AND p.cashback_estornado_em IS NULL THEN
    UPDATE public.usuarios SET saldo_cashback=coalesce(saldo_cashback,0)+p.cashback_debitado WHERE email=p.cliente_email;
    UPDATE public.pedidos SET cashback_estornado_em=now() WHERE id=p.id;
  END IF;
  credito:=CASE WHEN p.cashback_creditado_em IS NOT NULL THEN greatest(0,round(p.total*0.05,2)-p.cashback_revertido) ELSE 0 END;
  IF credito>0 THEN UPDATE public.usuarios SET saldo_cashback=coalesce(saldo_cashback,0)-credito WHERE email=p.cliente_email; END IF;
  UPDATE public.pedido_retiradas SET estado='cancelado',reembolsado_em=now(),erro=NULL,lease_id=NULL,locked_until=NULL,versao=versao+1 WHERE pedido_id=p_pedido_id RETURNING * INTO r;
  UPDATE public.pedidos SET status='cancelado',cashback_revertido=cashback_revertido+credito WHERE id=p.id RETURNING * INTO p;
  PERFORM public.hh_notificar_retirada(p,r,'retirada_reembolsada');
  RETURN true;
END $$;

CREATE FUNCTION public.hh_falha_reembolso_retirada(p_pedido_id text,p_lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.pedidos; r public.pedido_retiradas;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id::text=p_pedido_id FOR UPDATE;
  UPDATE public.pedido_retiradas SET erro='Reembolso ainda pendente. Confira saldo, pagamento e eventuais estornos no Mercado Pago. O sistema tentará novamente com a mesma chave.',
    lease_id=NULL,locked_until=NULL,proxima_tentativa=now()+interval '1 hour'
  WHERE pedido_id=p_pedido_id AND lease_id=p_lease AND estado='reembolso_pendente' RETURNING * INTO r;
  IF FOUND THEN PERFORM public.hh_notificar_retirada(p,r,'retirada_atencao','admin'); END IF;
END $$;

CREATE FUNCTION public.hh_proteger_status_retirada() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.pedido_retiradas;
BEGIN
  IF NEW.entrega->>'modalidade'='retirada' THEN
    SELECT * INTO r FROM public.pedido_retiradas WHERE pedido_id=NEW.id::text;
    IF NEW.status='enviado' OR (NEW.status='entregue' AND r.estado IS DISTINCT FROM 'retirado') THEN RAISE EXCEPTION 'Confirme a entrega presencial pelo fluxo de retirada'; END IF;
    IF r.estado='cancelado' AND coalesce(NEW.pagamento->>'status','refunded')='refunded' THEN NEW.status:='cancelado'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hh_proteger_status_retirada BEFORE UPDATE OF status,pagamento ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.hh_proteger_status_retirada();

DO $$ DECLARE t text; f record; BEGIN
  FOREACH t IN ARRAY ARRAY['loja_retirada','pedido_retiradas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
  FOR f IN SELECT oid::regprocedure assinatura FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
    ('hh_enqueue_notification','hh_notificar_retirada','hh_criar_retirada','hh_bloquear_etiqueta_retirada','hh_acao_retirada','hh_retirada_aviso_enviado','hh_ack_notificacao_retirada','hh_preparar_prazos_retirada','hh_claim_retirada_reembolsos','hh_concluir_reembolso_retirada','hh_falha_reembolso_retirada','hh_proteger_status_retirada') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.assinatura);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.assinatura);
  END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
