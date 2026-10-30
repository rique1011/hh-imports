# Auditoria e refatoração H&H IMPORTS

Data: 30/10/2026. Repositório de destino: `rique1011/hh-imports`, branch `main`.

## Resultado e limites da entrega

As correções de interface mobile e de autorização foram integradas ao backend NextAuth. Preços, descontos e frete são validados no servidor; a confirmação de pagamento consulta o pedido do dono autenticado. As migrações de RLS e estoque estão versionadas e foram testadas em Postgres local (PGlite). **Não foram aplicadas no Supabase remoto nesta entrega.** A publicação na Vercel também precisa ser coordenada com as migrações e com o inventário real.

Na consulta remota de 30/10/2026, o histórico de migrações continha somente `20261013040238_hh_notifications`; as políticas amplas `FOR ALL TO public USING (true)` ainda estavam presentes. O projeto Vercel `hh-imports` retornava como último deploy de produção uma versão anterior a esta entrega. O acesso a logs remotos não foi revalidado nesta finalização.

## Alterações principais

| Área | Arquivos principais | Resultado |
|---|---|---|
| Navegação mobile | `components/Header.tsx` | Drawer com Escape, controle de foco, bloqueio do scroll de fundo, busca flexível e badge com hidratação estável. |
| Galeria e PDP | `components/ZoomImagem.tsx`, `components/BotaoAdicionar.tsx`, `app/produto/[slug]/page.tsx` | Galeria com swipe, scroll snap, controles de 44 px, zoom via requestAnimationFrame, disponibilidade e CTA fixo no mobile. |
| Categoria | `app/categoria/FiltroCategoria.tsx` | Contêineres flex/grid com `min-w-0`, quebra de nomes longos e dimensões de imagens adequadas. |
| Carrinho e checkout | `app/carrinho/page.tsx`, `app/api/checkout/route.ts`, `lib/frete.ts`, `lib/cupons.ts` | Quantidade e ações acessíveis; cotação de frete assinada, vinculada ao CEP e com validade; cupons privados validados no backend. |
| Confirmação | `app/sucesso/page.tsx`, `app/api/pedidos/[id]/route.ts`, `app/order-success/[id]/page.tsx` | Consulta restrita ao comprador; pendência não anuncia aprovação; somente status pago confirmado no banco limpa a sacola. |
| Conta e pedidos | `app/minha-conta/page.tsx`, `app/pedidos/page.tsx`, `app/api/usuario/route.ts`, `app/api/pedidos/route.ts` | DTO sem senha/token, pedidos filtrados pelo dono, inputs mobile e tratamento de falhas; `/pedidos` abre o histórico real da conta, substituindo dados de exemplo. |
| Administração | `app/admin/*`, `app/api/admin/dados/route.ts`, `lib/admin-client.ts` | Autorização administrativa no servidor, recursos/colunas/operações permitidos explicitamente e navegação que se adapta ao celular. |
| Uploads, avaliações e trocas | `app/api/uploads/route.ts`, `app/api/avaliacoes/route.ts`, `app/api/trocas/route.ts` | Upload autenticado com limite/tipo de arquivo, avaliação vinculada ao nome da conta, troca vinculada a item entregue do comprador. |
| Tipagem e imagens | `types/loja.ts`, `types/next-auth.d.ts`, `lib/erros.ts`, páginas e componentes | Tipos explícitos, remoção de variáveis sem uso, imagens redimensionadas com `next/image` e textos alternativos. A galeria mantém a imagem original para zoom. |
| Banco | `supabase/migrations/20261030141014_fechar_acesso_publico.sql`, `supabase/migrations/20261030141021_estoque_transacional.sql` | RLS/grants, índices, proteção de uploads, reservas atômicas, baixa única, devolução de reserva/cashback em cancelamento conciliado e normalização de itens novos. |

A home carrega consultas independentes em paralelo, seleciona somente os campos necessários e consulta o cupom de destaque no servidor. A tabela de cupons permanece privada; somente código e percentual escolhidos para o banner são renderizados. Fontes usam um único caminho de carregamento. Não há promessa de latência zero.

## Validação

- `npm run lint -- --max-warnings 0`: sem erros e sem avisos.
- `npm run typecheck`: aprovado.
- `npm run build`: build de produção aprovado, incluindo a verificação TypeScript do Next.js.
- `npm test`: 20 testes aprovados. Os testes de RLS foram repetidos após ampliar as verificações de INSERT/DELETE e reaplicação da migração.
- Chromium: 105 combinações (15 rotas, 7 larguras: 320, 360, 390, 768, 1024, 1440 e 2560 px), sem overflow horizontal do documento e sem erros JavaScript.
- 10 verificações de interação: menu, Escape, galeria, CTA mobile, persistência de quantidade, pedido pendente, manutenção da sacola pendente, limpeza após confirmação, API sem sessão e redirecionamento do painel sem sessão.
- Capturas locais de produto, sacola e confirmação foram inspecionadas visualmente.

O navegador usou fixtures locais com nomes longos e sessão NextAuth assinada de teste. SMTP e Mercado Pago não receberam pedidos nem e-mails reais. Os testes não equivalem a uma compra real em produção nem a um teste de carga. Persistem respostas 404 da API de visitas preexistente, registradas na evidência, sem afetar a compra.

As evidências resumidas estão em `docs/EVIDENCIAS_MOBILE_2026-10-30.json`. A suíte de backend é reproduzível com `npm ci` e `npm test`.

## Diagnóstico de gaps e preparação para produção

| Status | Funcionalidade ou configuração | Severidade | Próxima ação |
|---|---|---|---|
| Código concluído; implantação pendente | RLS de usuários, pedidos, cupons e demais tabelas privadas | Crítico | Aplicar a migração `fechar_acesso_publico` após disponibilizar backend autenticado e service role exclusivamente no servidor. Não usar `auth.uid()` para IDs de usuários do NextAuth. |
| Migração concluída; inventário pendente | Reservas e baixa transacional de estoque | Crítico | Conferir os pedidos pendentes anteriores, cadastrar quantidades reais e aplicar `estoque_transacional` antes de publicar o código que consulta `estoque_reservado`. Produtos com disponibilidade zero não podem ser vendidos. |
| Pendente de integração operacional | Expiração, cancelamento e conciliação de reservas de pedidos sem pagamento | Crítico | Implementar rotina de conciliação com o gateway. Não liberar reservas apenas pelo tempo sem verificar se o pagamento pode ser aprovado depois. |
| Pendente | Crédito de trocas por valor fixo | Crítico se oferecido ao cliente | O checkout atual valida desconto percentual; o painel legado ainda calcula crédito com preço genérico. Integrar o valor real dos itens, o dono e o consumo único do crédito antes de oferecer esse fluxo. |
| Configuração pendente de conferência | Melhor Envio | Crítico | Definir `MELHOR_ENVIO_TOKEN` e `CEP_ORIGEM`, validar cotação real e conferir peso/dimensões operacionais da embalagem. |
| Configuração pendente de conferência | Mercado Pago e webhook | Crítico | Definir tokens de produção, assinatura, URL `https://hh-imports.vercel.app/api/webhooks/mercadopago`; testar pagamento, repetição do webhook e estoque uma única vez. |
| Configuração pendente de conferência | Autenticação, SMTP/Resend e cron | Crítico | Conferir variáveis listadas abaixo, domínio remetente e envio real a cliente/admin. O caminho legado Resend ainda usa remetente de teste. |
| Pendente de publicação | GitHub/Vercel | Crítico | Conectar `rique1011/hh-imports`, branch `main`, ao projeto desejado e publicar o commit após preparar banco e ambiente. Conferir URL canônica e retorno do gateway. |
| Ausente | Variantes, SKUs e endereços múltiplos normalizados | Médio | Hoje existe produto simples e endereço em JSON/texto no perfil. Modelar antes de vender variações com estoque separado. |
| Parcial | Catálogo e pesquisa | Médio | Material e teto de preço estão implementados. Faltam paginação/infinite scroll, busca durante digitação com debounce e ordenação por relevância/preço. |
| Ausente | Contagem de visitas | Baixo | O componente chama `/api/visitas`, rota não existente, e recebe 404. Implementar com limitação de abuso ou retirar o contador. |
| Pendente | Dados comerciais e conteúdo de produção | Médio | Conferir e-mail, telefone, endereço, imagens, textos, preços e condições comerciais antes da abertura. |

### Ordem recomendada de implantação

1. Preparar uma janela de publicação e backup do banco. Confirmar a ligação da Vercel com o repositório novo.
2. Cadastrar/conferir o inventário real e conciliar pedidos existentes. A migração marca pagamentos históricos como já baixados, sem descontar retroativamente.
3. Revisar/aplicar as duas migrações SQL na ordem dos nomes. A migração de índices únicos interrompe a transação se houver e-mails ou trocas duplicados; corrigir os dados deliberadamente, sem apagá-los automaticamente.
4. Conferir as variáveis e publicar a versão da `main`. Evitar manter por longo tempo a versão antiga do frontend após bloquear as consultas públicas.
5. Confirmar no banco e via API que `anon`/`authenticated` não leem nem escrevem tabelas privadas; catálogo/categorias/avaliações permitem somente SELECT. Confirmar login/admin e uploads.
6. Validar compra real controlada: cotação, checkout, webhook, estoque, e-mails e status real na página de sucesso. Concluir as pendências críticas de reservas e crédito de trocas antes da abertura.

### Variáveis de ambiente a conferir

- Públicas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CONTACT_EMAIL`.
- Servidor: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SITE_URL`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MELHOR_ENVIO_TOKEN`, `CEP_ORIGEM`, `EMAIL_USER`, `EMAIL_PASS`, `ADMIN_EMAIL`, `CRON_SECRET`; `RESEND_API_KEY` se o caminho de cadastro Resend continuar em uso.
- Usar `https://hh-imports.vercel.app` como base canônica onde aplicável. Nunca prefixar segredos com `NEXT_PUBLIC_`.

## Lista completa de arquivos desta entrega

- `.env.example`
- `.gitignore`
- `app/admin/cupons/page.tsx`
- `app/admin/devolucoes/page.tsx`
- `app/admin/estoque/page.tsx`
- `app/admin/financeiro/page.tsx`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/pedidos/page.tsx`
- `app/api/admin/dados/route.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/recuperar/route.ts`
- `app/api/auth/redefinir/route.ts`
- `app/api/avaliacoes/route.ts`
- `app/api/cadastro/route.ts`
- `app/api/carrinho/salvar/route.ts`
- `app/api/checkout/route.ts`
- `app/api/cron/carrinho-abandonado/route.ts`
- `app/api/cron/recuperar/route.ts`
- `app/api/cupons/validar/route.ts`
- `app/api/frete/route.ts`
- `app/api/pedidos/[id]/route.ts`
- `app/api/pedidos/route.ts`
- `app/api/rastreio/[codigo]/route.ts`
- `app/api/register/route.ts`
- `app/api/trocas/email/route.ts`
- `app/api/trocas/route.ts`
- `app/api/uploads/route.ts`
- `app/api/usuario/route.ts`
- `app/api/verificar/route.ts`
- `app/cadastro/page.tsx`
- `app/carrinho/page.tsx`
- `app/categoria/FiltroCategoria.tsx`
- `app/esqueci-senha/page.tsx`
- `app/fale-conosco/page.tsx`
- `app/fretes-e-entregas/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/minha-conta/page.tsx`
- `app/order-success/[id]/page.tsx`
- `app/page.tsx`
- `app/pedidos/page.tsx`
- `app/pesquisa/page.tsx`
- `app/produto/[slug]/page.tsx`
- `app/produtos/page.tsx`
- `app/redefinir-senha/page.tsx`
- `app/sucesso/page.tsx`
- `app/verificar/page.tsx`
- `components/Avaliacoes.tsx`
- `components/BotaoAdicionar.tsx`
- `components/BotaoFavorito.tsx`
- `components/CalculadorFrete.tsx`
- `components/Categorias.tsx`
- `components/Footer.tsx`
- `components/Header.tsx`
- `components/ZoomImagem.tsx`
- `docs/AUDITORIA_ECOMMERCE_2026-10-30.md`
- `docs/EVIDENCIAS_MOBILE_2026-10-30.json`
- `eslint.config.mjs`
- `lib/admin-client.ts`
- `lib/autorizacao.ts`
- `lib/cupons.ts`
- `lib/erros.ts`
- `lib/frete.ts`
- `lib/supabase.ts`
- `lib/upload-imagem.ts`
- `lib/use-hidratado.ts`
- `supabase/migrations/20261030141014_fechar_acesso_publico.sql`
- `supabase/migrations/20261030141021_estoque_transacional.sql`
- `tests/estoque-frete.test.cjs`
- `tests/helpers.cjs`
- `tests/notificacoes.test.cjs`
- `tests/seguranca.test.cjs`
- `types/loja.ts`
- `types/next-auth.d.ts`

## Referências técnicas

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: proteção da Data API](https://supabase.com/docs/guides/api/securing-your-api)
- Documentação do Next.js 16.2.4 instalada em `node_modules/next/dist/docs/`, consultada para handlers, redirect, ESLint e imagens.
