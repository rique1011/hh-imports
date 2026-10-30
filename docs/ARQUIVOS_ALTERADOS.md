# H&H IMPORTS — arquivos alterados

Todos os arquivos abaixo acompanham a versão corrigida. Cada link abre o código completo. Aplique o conjunto completo, incluindo os auxiliares e a migração.

| Arquivo | Conteúdo |
|---|---|
| [.env.example](../.env.example) | Configuração/dependências |
| [.gitignore](../.gitignore) | Configuração/dependências |
| [README.md](../README.md) | Documentação e aplicação |
| [app/admin/devolucoes/page.tsx](../app/admin/devolucoes/page.tsx) | Marca, e-mails ou consistência de status |
| [app/admin/layout.tsx](../app/admin/layout.tsx) | Marca, e-mails ou consistência de status |
| [app/admin/page.tsx](../app/admin/page.tsx) | Marca, e-mails ou consistência de status |
| [app/admin/pedidos/page.tsx](../app/admin/pedidos/page.tsx) | Marca, e-mails ou consistência de status |
| [app/api/auth/\[...nextauth\]/route.ts](../app/api/auth/[...nextauth]/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/auth/recuperar/route.ts](../app/api/auth/recuperar/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/cadastro/route.ts](../app/api/cadastro/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/checkout/route.ts](../app/api/checkout/route.ts) | Pedido, notificações iniciais, valores e preferência Mercado Pago |
| [app/api/cron/carrinho-abandonado/route.ts](../app/api/cron/carrinho-abandonado/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/cron/notificacoes/route.ts](../app/api/cron/notificacoes/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/cron/recuperar/route.ts](../app/api/cron/recuperar/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/frete/route.ts](../app/api/frete/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/notificacoes/pedido/route.ts](../app/api/notificacoes/pedido/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/pedidos/pagar/route.ts](../app/api/pedidos/pagar/route.ts) | Pagamento pendente com notification_url e checagem do dono |
| [app/api/rastreio/\[codigo\]/route.ts](../app/api/rastreio/[codigo]/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/register/route.ts](../app/api/register/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/trocas/email/route.ts](../app/api/trocas/email/route.ts) | Marca, e-mails ou consistência de status |
| [app/api/webhooks/mercadopago/route.ts](../app/api/webhooks/mercadopago/route.ts) | Assinatura, consulta do pagamento, confirmação e envio |
| [app/cadastro/page.tsx](../app/cadastro/page.tsx) | Marca, e-mails ou consistência de status |
| [app/carrinho/page.tsx](../app/carrinho/page.tsx) | Marca, e-mails ou consistência de status |
| [app/fale-conosco/page.tsx](../app/fale-conosco/page.tsx) | Marca, e-mails ou consistência de status |
| [app/fretes-e-entregas/page.tsx](../app/fretes-e-entregas/page.tsx) | Marca, e-mails ou consistência de status |
| [app/globals.css](../app/globals.css) | Marca, e-mails ou consistência de status |
| [app/icon.svg](../app/icon.svg) | Marca, e-mails ou consistência de status |
| [app/layout.tsx](../app/layout.tsx) | Marca, e-mails ou consistência de status |
| [app/minha-conta/page.tsx](../app/minha-conta/page.tsx) | Marca, e-mails ou consistência de status |
| [app/page.tsx](../app/page.tsx) | Marca, e-mails ou consistência de status |
| [app/privacidade/page.tsx](../app/privacidade/page.tsx) | Marca, e-mails ou consistência de status |
| [app/produto/\[slug\]/page.tsx](../app/produto/[slug]/page.tsx) | Marca, e-mails ou consistência de status |
| [app/sobre/page.tsx](../app/sobre/page.tsx) | Marca, e-mails ou consistência de status |
| [app/sucesso/page.tsx](../app/sucesso/page.tsx) | Marca, e-mails ou consistência de status |
| [app/termos/page.tsx](../app/termos/page.tsx) | Marca, e-mails ou consistência de status |
| [app/trocas/page.tsx](../app/trocas/page.tsx) | Marca, e-mails ou consistência de status |
| [components/Footer.tsx](../components/Footer.tsx) | Marca, e-mails ou consistência de status |
| [components/Header.tsx](../components/Header.tsx) | Marca, e-mails ou consistência de status |
| [components/Hero.tsx](../components/Hero.tsx) | Marca, e-mails ou consistência de status |
| [docs/ARQUIVOS_ALTERADOS.md](../docs/ARQUIVOS_ALTERADOS.md) | Documentação e aplicação |
| [docs/IMPLEMENTACAO_HH_IMPORTS.md](../docs/IMPLEMENTACAO_HH_IMPORTS.md) | Documentação e aplicação |
| [lib/brand.ts](../lib/brand.ts) | Nome da marca e contato público |
| [lib/mail.ts](../lib/mail.ts) | Templates H&H IMPORTS e envio para cliente/admin |
| [lib/mercadopago.ts](../lib/mercadopago.ts) | Cliente Mercado Pago e assinatura HMAC |
| [lib/notificacoes.ts](../lib/notificacoes.ts) | Processamento e recuperação da fila |
| [lib/request-user.ts](../lib/request-user.ts) | Leitura do cookie de sessão NextAuth |
| [lib/site-url.ts](../lib/site-url.ts) | URL pública do site |
| [lib/supabase-admin.ts](../lib/supabase-admin.ts) | Cliente privado Supabase |
| [package-lock.json](../package-lock.json) | Configuração/dependências |
| [package.json](../package.json) | Configuração/dependências |
| [supabase/migrations/20261013040238_hh_notifications.sql](../supabase/migrations/20261013040238_hh_notifications.sql) | Transações, triggers, idempotência e fila privada; aplicada no Supabase |
| [tests/helpers.cjs](../tests/helpers.cjs) | Verificação automatizada |
| [tests/notificacoes.test.cjs](../tests/notificacoes.test.cjs) | Verificação automatizada |
| [docs/STATUS_IMPLANTACAO.md](STATUS_IMPLANTACAO.md) | Migração aplicada, evidências de validação e pendências de publicação |
| [vercel.json](../vercel.json) | Cron diário para recuperar falhas |

Os três arquivos centrais importam auxiliares desta lista. A migração deve constar no histórico antes da publicação; ela já foi aplicada no projeto AnHel Imports. Consulte [o status da implantação](STATUS_IMPLANTACAO.md).

Verificação: onze testes passaram; TypeScript, build Next.js e lint dos módulos novos passaram. O envio SMTP e o pagamento em produção ainda precisam ser validados após configurar o ambiente.
