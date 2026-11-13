# Cancelamento de pedidos com entrega

O cliente pode cancelar em **Minha conta → Meus pedidos → Ver detalhes do pedido → Cancelar pedido e solicitar reembolso**. O administrador usa a mesma ação em **Admin → Pedidos → Detalhes** e registra o motivo. É necessário confirmar o cancelamento.

## Quando está disponível

- Pagamento aprovado, sem estorno parcial, contestação ou devolução em andamento.
- Envio ainda não iniciado: sem rastreio, recebimento, etiqueta remota ou worker de expedição em operação.
- Pedidos pagos apenas com créditos da loja também podem ser cancelados.
- O administrador pode resolver pagamentos aprovados que chegaram depois da liberação da reserva, após conferir o caso na atenção financeira.

Pedidos com etiqueta em processamento ou já vinculada ao Melhor Envio exigem conferência do atendimento. O cancelamento automático não cancela etiquetas nem confirma que uma mercadoria deixou de ser postada. Pedidos enviados/entregues seguem o fluxo de devolução. A retirada presencial mantém seu fluxo próprio.

## Processamento financeiro

1. Uma transação registra o pedido de cancelamento, bloqueia preparação/envio e pausa a expedição automática.
2. Após responder à solicitação, o servidor inicia a conferência do pagamento no Mercado Pago.
3. Confere ID, referência do pedido, moeda e valor integral original. Solicita reembolso integral com uma chave de idempotência persistente.
4. Consulta o pagamento novamente. Só conclui quando o provedor confirma o estorno integral.
5. Após a confirmação, repõe estoque e créditos usados uma única vez e reverte o cashback concedido pela compra. O valor do frete cobrado faz parte do total reembolsado.
6. O cliente recebe a confirmação por e-mail e acompanha o estado no próprio pedido. O prazo para o dinheiro aparecer na conta ou fatura depende do provedor e do banco.

Falhas, saldo insuficiente, timeouts ou respostas inconclusivas ficam pendentes. O cron diário existente de notificações retoma os casos disponíveis. O administrador pode antecipar a conferência em **Pedidos → Reembolsos → Detalhes → Consultar e retomar reembolso**. Todas as tentativas usam a mesma chave. Um timeout após sucesso remoto é conciliado sem outro estorno.

Um erro de navegação, retorno do checkout ou conexão não solicita reembolso. Pagamentos recusados e pendentes não são tratados como cobranças aprovadas.

## Configuração e validação

- Usa as variáveis existentes `MP_ACCESS_TOKEN`, `CRON_SECRET` e as credenciais de e-mail. Não exige token adicional.
- Aplicar a migração `20261113125716_cancelamento_pedidos_entrega.sql` antes de publicar o código que usa a fila.
- A tabela `pedido_cancelamentos` e suas funções são privadas, acessíveis somente ao backend com `service_role`.
- APIs exigem sessão vigente, autorização sobre o pedido, origem válida e limitação de tentativas. Ações administrativas exigem MFA.
- Os testes financeiros e de interface usam banco e provedores simulados, sem movimentar dinheiro real.
