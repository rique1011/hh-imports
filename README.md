# H&H IMPORTS

E-commerce em Next.js 16.2.4, Supabase, NextAuth, Nodemailer e Mercado Pago.

## Correções de marca e notificações

Consulte [o guia completo de aplicação](docs/IMPLEMENTACAO_HH_IMPORTS.md) e [a lista de arquivos alterados](docs/ARQUIVOS_ALTERADOS.md).

Antes de publicar a versão corrigida:

1. Confira a migração em supabase/migrations. Ela já foi aplicada no projeto AnHel Imports em 13/10/2026; execute apenas em ambientes que ainda não tenham essa migração.
2. Configure as variáveis descritas em .env.example na Vercel.
3. Publique o código e valide um pagamento real de homologação.

Consulte [o status da implantação](docs/STATUS_IMPLANTACAO.md) para distinguir o banco já preparado das etapas pendentes na Vercel.

A fila privada registra pedido recebido e pagamento aprovado para cliente e administrador, além de enviado/entregue para o cliente. Falhas de SMTP ficam pendentes para recuperação. O cron de recuperação diário está em vercel.json.

## Execução local

Instale as dependências com npm ci, configure .env.local conforme .env.example e execute npm run dev.

## Verificação

- npm test: testes dos handlers, e-mail e migração PostgreSQL.
- npm run typecheck: verificação TypeScript.
- npm run build: compilação de produção.

Os testes usam integrações externas de teste e não enviam mensagens a clientes reais.

