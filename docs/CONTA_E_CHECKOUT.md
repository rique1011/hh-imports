# Conta, endereços e pagamentos

## Comportamento

- O detalhe do pedido exibe o meio de pagamento obtido na consulta autenticada ao Mercado Pago: Pix, crédito (parcelas), débito, boleto, saldo ou transferência. Créditos da loja e pedidos sem cobrança têm rótulos próprios. Antes de uma tentativa, aparece “A escolher no Mercado Pago”. Pedidos antigos sem informação não recebem um método inventado.
- A conta permite salvar vários endereços, editar, remover e definir um padrão. O checkout seleciona um endereço pertencente ao usuário autenticado e valida a cotação assinada contra o CEP escolhido. O pedido guarda uma cópia do endereço, preservada após alterações no cadastro. O admin e a etiqueta usam essa cópia.
- O retorno do provedor passa por `/sucesso?pedido=ID`, verifica o pedido privado e consulta o pagamento no servidor. Abre “Meus pedidos” com a compra expandida. Parâmetros `status=approved` não aprovam compras nem limpam a sacola; só dados confirmados pelo servidor fazem isso.

## Prazo e conciliação

A janela para **iniciar um novo pagamento** é de 24 horas após a criação do pedido. O botão “Pagar agora” deixa de aparecer depois desse prazo; a preferência criada no Mercado Pago tem o mesmo vencimento e não ganha mais 24 horas a cada clique. Pedidos pendentes vencidos e cancelados ficam em “Não concluídos”, com acesso também pelo filtro “Todos”. Nenhum histórico é apagado.

A janela de checkout não equivale a cancelar uma transação bancária. Pix, boleto e pagamentos em análise já iniciados continuam sendo conciliados, inclusive se a confirmação ocorrer após as 24 horas. Não alteramos o vencimento dos boletos nem chamamos cancelamento ou estorno do provedor.

Para liberar uma reserva automaticamente, o servidor exige simultaneamente: preferência nova controlada pela loja; prazo vencido há pelo menos dez minutos; consulta autenticada sem qualquer tentativa de pagamento; preferência realmente vencida no provedor; pedido ainda pendente, sem pagamento associado; versão da conferência ainda atual. A função SQL trava o pedido e o trigger existente devolve estoque reservado e cashback utilizado uma única vez.

Pedidos legados sem preferência controlada são organizados na aba “Não concluídos”, mas não têm reservas liberadas por suposição. Se ocorrer aprovação excepcional após uma reserva automática ter sido liberada, o status vira `pagamento_em_analise`, o admin é avisado e a expedição automática fica suspensa para conferência de estoque e créditos. Não há estorno automático.

## Segurança e operação

A tabela `usuario_enderecos` tem RLS e acesso somente pelo backend `service_role`. Cada API valida sessão e propriedade; escritas também validam origem. As funções SQL usam SECURITY INVOKER, search_path vazio e EXECUTE restrito ao serviço. O DTO de pedidos não exporta preferências, CPF, telefone nem dados sensíveis de cartão.

Aplicar a migração `conta_enderecos_pagamentos` antes de publicar. Ela importa os endereços estruturados existentes e acrescenta os campos e RPCs. Usa as credenciais atuais `MP_ACCESS_TOKEN` e `CRON_SECRET`, sem novas variáveis.

O cron `/api/cron/pagamentos` executa diariamente às 12h UTC, respeitando o plano com execução diária. Confere até 12 pedidos novos e dois legados por execução, em grupos de três. Webhook e retorno do comprador complementam a conferência. A hora de execução pode variar no plano gratuito. A compra paga entra nas filas existentes de e-mail e envio, preservando a idempotência.

## Verificação

Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`. Os testes usam PostgreSQL isolado e provedores simulados para verificar propriedade, endereço/frete, prazo, confirmação tardia, replay e estoque/cashback. Não comprar etiquetas reais nem disparar mensagens ao cliente durante a verificação.
