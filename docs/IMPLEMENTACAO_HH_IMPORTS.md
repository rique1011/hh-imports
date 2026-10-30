# H&H IMPORTS — aplicação das correções

O checkout registra o pedido e as notificações de cliente e administrador. O webhook consulta o pagamento na API autenticada do Mercado Pago, confirma o pedido numa transação e registra as notificações de aprovação. O envio usa Nodemailer/Gmail; a fila mantém as falhas para novas tentativas. As mudanças para enviado e entregue também geram notificações.

## 1. Banco de dados

No projeto Supabase AnHel Imports, esta migração já foi aplicada em 13/10/2026, com a versão 20261013040238 registrada no histórico. Os testes no banco passaram e os pedidos e saldos existentes foram preservados. Consulte [o status da implantação](STATUS_IMPLANTACAO.md).

Para um novo ambiente que ainda não tenha essa migração, faça um backup e aplique:

- [20261013040238_hh_notifications.sql](../supabase/migrations/20261013040238_hh_notifications.sql)

A migração cria a tabela privada pedido_notificacoes, os triggers e três funções acessíveis somente por service_role: criação do pedido, confirmação do pagamento e aquisição de notificações. Ela acrescenta mp_payment_id e cashback_creditado_em a pedidos.

A criação do pedido desconta o cashback e registra as notificações na mesma transação. A aprovação confere o valor pago, associa o ID do Mercado Pago e credita 5% apenas uma vez. Webhooks repetidos preservam status de envio/entrega e notificações já registradas.

Pedidos antigos já confirmados/pagos/em separação/enviados/entregues recebem a marca de cashback processado para não ganhar o crédito novamente. A migração não envia mensagens nem cria notificações retroativas em massa. Uma nova notificação de pagamento pode recuperar os e-mails de aprovação de um pedido antigo.

## 2. Variáveis na Vercel

Use [.env.example](../.env.example) como referência. Configure Production e Preview conforme o ambiente usado.

| Variável | Finalidade |
|---|---|
| SITE_URL | URL pública HTTPS da loja; utilizada nos links e em notification_url |
| NEXTAUTH_URL / NEXTAUTH_SECRET | URL e segredo da autenticação existente |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | Cliente público já existente |
| SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY | Operações privadas de pedidos e fila; a chave nunca vai ao navegador |
| EMAIL_USER | Conta Gmail que envia as mensagens |
| EMAIL_PASS | Senha de aplicativo dessa conta Gmail, com verificação em duas etapas habilitada |
| ADMIN_EMAIL | Destinatário das notificações administrativas; opcional, usa EMAIL_USER quando vazio |
| NEXT_PUBLIC_CONTACT_EMAIL | E-mail público de atendimento exibido no site; use uma caixa que já exista |
| MP_ACCESS_TOKEN | Access Token da conta Mercado Pago responsável pelos pagamentos |
| MP_WEBHOOK_SECRET | Assinatura secreta obtida na configuração de Webhooks da mesma aplicação |
| CRON_SECRET | Segredo aleatório que protege a execução automática da fila |
| RESEND_API_KEY / MELHOR_ENVIO_TOKEN | Integrações antigas ainda utilizadas em outras rotas |

A troca da marca não cria um novo endereço de e-mail. O nome de exibição passa a H&H IMPORTS e a conta SMTP continua sendo a definida em EMAIL_USER.

O segredo fixo no código de autenticação foi removido. NEXTAUTH_SECRET precisa estar configurado e ser igual entre login e leitura de sessões.

## 3. Mercado Pago

Em Suas integrações → aplicação → Webhooks:

1. Configure https://SEU-DOMINIO/api/webhooks/mercadopago em produção.
2. Ative a criação/atualização de pagamentos (payment).
3. Copie a assinatura secreta para MP_WEBHOOK_SECRET.
4. Use MP_ACCESS_TOKEN e assinatura pertencentes à mesma aplicação/conta.
5. Mantenha a rota acessível ao Mercado Pago. A assinatura autentica a chamada.

O checkout e a rota de pagamento de pedidos pendentes incluem notification_url e external_reference. O endpoint consulta Payment.get e considera somente o status approved obtido da API. O status recebido no corpo não pode confirmar um pedido.

A simulação do painel com ID de pagamento fictício não comprova uma venda aprovada nem o envio de e-mails. Faça a validação de homologação com um pagamento de teste real e as credenciais adequadas.

Enviado e entregue são status da operação da loja. Eles surgem quando o administrador altera o pedido, não por uma aprovação financeira do Mercado Pago.

## 4. Fila, tentativas e cron

O SQL faz o registro durável antes de responder ao Mercado Pago. after() mantém o envio em execução após a resposta HTTP. Uma falha SMTP deixa a notificação pendente, com atraso crescente; uma execução interrompida libera o lease depois de três minutos.

O painel chama /api/notificacoes/pedido depois de salvar alterações para iniciar o envio imediato. A API exige sessão e verifica se o cadastro do usuário tem perfil/role admin. O trigger mantém a notificação registrada mesmo se essa chamada falhar.

[vercel.json](../vercel.json) contém uma execução diária às 10:00 UTC (07:00 em Brasília), compatível com o limite diário do plano Hobby. Nesse plano, a execução pode ocorrer em qualquer minuto da hora agendada. Esse cron é uma recuperação de falhas; o envio normal acontece imediatamente após checkout, webhook ou mudança no painel.

Em planos com cron mais frequente, você pode mudar o agendamento para */15 * * * *. Confirme o limite do seu plano antes de alterar. A rota processa até cinco lotes de vinte notificações e para ao encontrar falhas. Para executar manualmente, use um GET autenticado em /api/cron/notificacoes com o cabeçalho Authorization: Bearer <CRON_SECRET>.

Para diagnosticar no SQL Editor:

    select pedido_id, evento, destinatario, status, tentativas, erro, enviada_em
    from public.pedido_notificacoes
    order by id desc
    limit 50;

A fila evita repetir notificações marcadas como enviadas e separa o resultado de cada destinatário. SMTP não fornece uma transação conjunta com o banco: se o processo cair após a aceitação SMTP e antes de registrar enviada, uma retomada poderá repetir essa mensagem. A confirmação do pedido e o cashback continuam protegidos pela transação.

## 5. Publicação e validação

1. Confirme a migração no histórico do Supabase. No projeto AnHel Imports ela já foi aplicada; em um novo ambiente, aplique o SQL antes de publicar.
2. Configure as variáveis.
3. Publique o código corrigido.
4. Crie um pedido de teste: cliente e admin devem receber pedido recebido.
5. Aprove o pagamento de teste: o pedido deve ficar confirmado, cliente recebe pagamento aprovado e admin recebe o aviso para separar o produto.
6. Reenvie o webhook: o cashback e as notificações já enviadas não devem se repetir.
7. Marque o pedido como enviado com rastreio e depois entregue; confira as mensagens do cliente.
8. Inspecione a fila e os logs se alguma mensagem continuar pendente.

## Verificação automatizada

Execute:

    npm ci
    npm test
    npm run typecheck
    npm run build

Os testes executam a migração em PostgreSQL embutido (PGlite), os handlers reais e o módulo de e-mail com transporte SMTP de teste. Verificam pedido novo, aprovação, repetição de webhook, recuperação de falha parcial, estados de entrega, assinatura, valor, cashback, leases e cookies NextAuth.

Após a conexão do Supabase, a migração foi aplicada e validada no banco real. O acesso às configurações da equipe da Vercel continua retornando 403. Por isso, os valores atuais de produção, a publicação e a entrega em caixas de e-mail reais continuam pendentes.

Fontes: [Webhooks do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks), [Nodemailer e Gmail](https://nodemailer.com/guides/using-gmail), documentação do Next.js 16.2.4 incluída em node_modules/next/dist/docs.

