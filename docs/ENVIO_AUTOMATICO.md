# Expedição automática — H&H IMPORTS

Implementação de 05/11/2026. A configuração começa **desativada**, sem comprar etiquetas de pedidos anteriores à ativação. Não há nova variável de ambiente obrigatória: usa o remetente, token, CEP, medidas e cron secret já existentes.

## Ativação única no painel

1. Abra **Admin → Pedidos → Expedição automática**.
2. Defina o **limite em reais por etiqueta**, que será debitado do saldo do Melhor Envio. A cotação atualizada e o valor retornado pelo carrinho precisam caber na autorização.
3. Escolha a documentação. **NF-e** aguarda a chave de 44 dígitos de cada pedido; este sistema não emite NF-e. **Declaração de conteúdo** exige confirmação de que esses envios estão dispensados de NF-e. CPF não determina essa dispensa. Quando elegível, o Melhor Envio processa a DC-e com os itens do pedido.
4. Confira o saldo, cadastro, permissões do token e medidas/peso reais. Informe agência se exigida pelo serviço utilizado.
5. Clique em **Ativar compra automática**. Vale para pagamentos confirmados depois da ativação. Pedidos anteriores continuam disponíveis no fluxo manual, sem compras retroativas.

Após confirmação autenticada pelo Mercado Pago, o banco grava o trabalho na mesma transação do pagamento. O backend consulta o frete atualizado e compra a etiqueta, mesmo sem o painel aberto. Pedidos quitados por cashback também entram no fluxo. O serviço contratado pelo cliente é mantido. No frete grátis sem serviço escolhido, utiliza o menor preço entre PAC/SEDEX (IDs 1/2); indisponibilidade requer revisão, sem substituir silenciosamente o serviço.

Abra os detalhes do pedido para **Abrir etiqueta / PDF** e, para DC-e, **Imprimir declaração de conteúdo (DACE)**. O painel acompanha a geração por consultas automáticas. A impressora física continua sendo acionada por você. O rastreio pode chegar depois da etiqueta; quando disponível, o sistema atualiza o pedido e registra o e-mail na fila existente.

## Pendências e retomada

- Limite excedido, dados recusados, documentação ausente ou possível falta de saldo aparecem no quadro de pendências. Após corrigir saldo/configuração, abra o pedido e clique em **Retomar após corrigir a pendência**. A retomada aplica a configuração atual, preservando o envio já inserido e o mesmo ID do fornecedor.
- No modo NF-e, informe a chave nos detalhes e clique em **Salvar NF-e e continuar automaticamente**.
- **Pausar automação** suspende novos trabalhos e novas compras ainda não iniciadas. Requisições externas que já começaram podem concluir; a pausa não cancela fretes comprados. A consulta de etiquetas já pagas pelo cron anterior continua disponível.
- **Usar modo manual neste pedido** suspende o trabalho daquele pedido antes de liberar o formulário manual. Não permite trocar enquanto houver um processamento com lease ativo.
- Se a inserção no carrinho tiver resultado incerto sem ID confirmado, confira no Melhor Envio pela tag `HH-PEDIDO-ID`. O sistema bloqueia outra inserção. Não apague o checkpoint para tentar novamente.

As configurações são salvas por administrador autenticado, com validação de origem. O teto menor entre a autorização salva no pagamento e a configuração atual também protege carrinhos ainda não pagos. Para autorizar um teto maior para uma pendência, ajuste a configuração e retome explicitamente o pedido. Etiquetas já compradas continuam vinculadas ao seu snapshot original.

## Filas, concorrência e contingência

`envio_automatico_config` e `envio_automatico_fila` são privadas, com RLS e sem permissões para PUBLIC, anon ou authenticated. As funções são SECURITY INVOKER, executáveis somente por service_role. O cliente recebe apenas DTOs de configuração/estado; tokens e dados fiscais completos ficam no servidor.

Há uma entrada por pedido, lease de três minutos na fila e outro mutex em `pedido_envios`. Replays do webhook não geram outra compra. Cada chamada financeira mantém os checkpoints da integração existente. Timeout de checkout consulta o mesmo ID e não repete a cobrança sem confirmação. Falhas temporárias usam backoff e, após cinco tentativas sem resolução, pedem atenção. Rejeições de cadastro/saldo pedem correção antes de retomar.

O processamento imediato usa `after()` do Next.js, com fila já persistida antes do ACK. Uma segunda conferência curta cobre a geração assíncrona normal. O cron separado `/api/cron/envios` roda diariamente às 11h UTC e retoma até três trabalhos, com orçamento de tempo. A agenda diária é compatível com o plano Hobby da Vercel; o processamento principal ocorre no pagamento. O cron de e-mails às 10h UTC permanece separado. Em alto volume, use uma fila/worker frequente e adequado ao plano, em vez de depender do cron diário para a contingência.

GET de etiqueta é somente leitura. O acompanhamento no painel usa POST `sincronizar`, que só agenda consultas a IDs já em confirmação de pagamento ou geração, protegidas novamente no worker. Essa ação não libera carrinhos novos ou ainda não pagos para checkout. Se uma operação ficar parada ou o fornecedor liberar rastreio mais tarde, também é possível retomar explicitamente no painel.

## Arquivos principais

- `lib/envio-automatico.ts`: configuração validada, escolha de frete, teto, worker e DTOs.
- `supabase/migrations/*_envio_automatico.sql`: configuração inicial inativa, trigger transacional, fila e funções privadas.
- `app/api/admin/envio-automatico/route.ts`: configuração e pendências.
- `app/api/admin/envio-automatico/pedido/route.ts`: NF-e, retomada, acompanhamento e modo manual.
- `app/api/cron/envios/route.ts` e `vercel.json`: contingência diária com autenticação.
- `app/api/webhooks/mercadopago/route.ts` e `app/api/checkout/route.ts`: disparo após pagamento confirmado.
- `components/admin/EnvioAutomaticoConfig.tsx`, `components/admin/EtiquetaMelhorEnvio.tsx`, `app/admin/pedidos/page.tsx`: painel responsivo e impressão.
- `tests/envio-automatico.test.cjs`: testes com Postgres local e APIs/SMTP simulados, sem compras reais.

Documentação oficial: [compra e documentação fiscal do Melhor Envio](https://docs.melhorenvio.com.br/docs/compra-de-fretes), [geração assíncrona](https://docs.melhorenvio.com.br/reference/geracao-de-etiquetas), [cron Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
