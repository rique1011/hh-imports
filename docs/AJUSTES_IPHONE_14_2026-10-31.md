# Responsividade e carregamento no iPhone 14

Data: 31/10/2026. Repositório `rique1011/hh-imports`, branch `main`. Base: `d424991b116de9b6de2b7fe70421f9b44e7491bc`.

O catálogo, a conta e os formulários agora ocupam melhor a tela do celular. O menu e os modais preservam a posição da página ao abrir e fechar; os campos têm tamanho legível também em orientação horizontal. A galeria mantém swipe, botões e zoom original com mouse, carregando esse original somente quando necessário.

## Arquivos e comportamento

| Arquivos | Alteração |
|---|---|
| `app/layout.tsx`, `app/globals.css` | Viewport com áreas seguras, altura dinâmica, proteção contra aumento automático de texto, campos de pelo menos 16 px em telas menores/dispositivos de toque, alvos de toque e espaço para o botão fixo. O zoom do usuário continua permitido. |
| `components/Header.tsx`, `lib/scroll-lock.ts` | Bloqueio/restauração da rolagem com posição preservada; menu fecha quando a tela muda para desktop. |
| `components/Modal.tsx` | Portal, nome acessível, foco contido, Escape, restauração de foco/rolagem e ajuste à área visível quando o teclado reduz a tela. |
| `app/admin/cupons/page.tsx`, `app/admin/estoque/page.tsx`, `app/admin/pedidos/page.tsx` | Modais adaptados ao componente comum; controles de fechamento maiores e formulário com rolagem. |
| `app/minha-conta/page.tsx` | Abas em grade no celular, sem opções escondidas em uma faixa horizontal; modal de troca adaptável e assinatura seletiva do estado da sacola. |
| `app/carrinho/page.tsx` | Modal da oferta adaptável, assinatura seletiva do estado e consulta de sugestões somente quando os produtos da sacola mudam. Alterar quantidade não repete essa consulta. Consultas obsoletas são canceladas. |
| `components/ZoomImagem.tsx`, `app/produto/[slug]/page.tsx`, `components/BotaoAdicionar.tsx` | Imagens de prévia redimensionadas, original de zoom sob demanda, galeria quadrada e seleção preservada na rotação; título com quebra de nomes longos e barra de compra respeitando áreas seguras. |
| `components/AvaliacoesDiferidas.tsx` | Código das avaliações carregado perto da seção; estrelas, comentário e fluxo original preservados. |
| `app/categoria/FiltroCategoria.tsx`, `app/categoria/[slug]/page.tsx` | Contraste corrigido para o tema da loja, filtros compactos e alvos maiores, grade de duas colunas no celular e consulta somente dos campos exibidos. |
| `app/page.tsx`, `app/colecoes/page.tsx`, `app/produtos/page.tsx`, `app/pesquisa/page.tsx` | Banner com altura estável, imagens de coleção otimizadas, nomes em duas linhas, espaçamento e grades ajustados. Catálogo/pesquisa consultam somente os campos necessários. |

Não foram alterados handlers de pagamento, autenticação, cálculo de preços/descontos, regras de estoque ou migrações do banco nesta entrega. O documento de auditoria de 30/10 é um registro histórico; este relatório cobre a nova rodada de interface e carregamento.

## Validação realizada

- ESLint com `--max-warnings 0`: aprovado.
- TypeScript com `tsc --noEmit`: aprovado.
- Build de produção pelo executável Next.js 16.2.4 (`next build`): aprovado, incluindo checagem TypeScript.
- Backend: 20 testes aprovados, sem falhas.
- Navegador: 15 rotas em seis tamanhos — 390×664, 390×844, 844×390, 320×568, 768×1024 e 1440×900 — totalizando 90 combinações e 277 verificações. Nenhum overflow horizontal do documento ou erro JavaScript. Nenhum campo visível avaliado ficou abaixo de 16 px.
- Interações: abertura/fechamento do menu, transição para desktop, swipe e setas da galeria, rotação preservando seleção, zoom com mouse, inclusão na sacola, quantidade persistida, consulta de sugestões sem repetição, modal com viewport reduzida, Escape, devolução da rolagem, troca com upload obrigatório por defeito, estrelas/comentário, filtros e reset, pedido pendente preservando sacola e confirmação de pedido de teste limpando sacola.
- Capturas de home, categoria, produto, sacola, conta e modal administrativo inspecionadas visualmente.

As evidências resumidas estão em `docs/EVIDENCIAS_IPHONE_14_2026-10-31.json`. Backend reproduzível com `npm ci` e `npm test`.

## Medição de carregamento

Na primeira visualização da página de produto, em 390×664 e com os mesmos dados de teste, a soma gzip dos scripts externos presentes na página caiu de **269.748 para 217.164 bytes: redução de 19,5%**. A medição inclui o runtime compartilhado e demonstra redução de código inicial, sem equivaler a uma medição de velocidade em rede celular. Não se afirma a mesma redução em todas as páginas.

As avaliações passam a carregar perto da seção, e a imagem original de zoom passa a carregar ao usar o mouse sobre a galeria. As prévias continuam otimizadas no celular. Não foi introduzido cache de pedidos ou estoque que possa tornar essas informações desatualizadas.

## Limites e próximos testes

O ZIP fornecido contém somente uma pasta `monile` vazia. Não havia capturas para comparar com o defeito observado pelo usuário. A verificação usou Chromium com viewport, toque e DPR do iPhone 14; não substitui Safari em um iPhone físico nem reproduz integralmente teclado e áreas seguras do aparelho. A redução da área visível do teclado foi simulada alterando o viewport.

Nenhum pedido, pagamento, upload ou e-mail real foi criado por estes testes. A chamada preexistente `/api/visitas` continua retornando 404, sem erro JavaScript ou interrupção das interações verificadas.

Após a publicação, conferir no iPhone real menu, rotação, galeria, CEP/cupom, teclado, conta e fechamento dos modais. Reenviar as capturas reais permite conferir os defeitos específicos originalmente observados.

As pendências operacionais já apontadas na auditoria anterior continuam exigindo validação antes de abrir a loja: compra controlada com cotação, pagamento, webhook, estoque e e-mails; conciliação de reservas de pagamentos pendentes/cancelados; fluxo de crédito de trocas por valor fixo. Esta rodada de responsividade não implementa essas integrações.

## Referências técnicas consultadas

- Documentação local do Next.js 16.2.4 para viewport, imagens e carregamento dinâmico.
- [WebKit: áreas seguras e viewport-fit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
- [Next.js: Image](https://nextjs.org/docs/app/api-reference/components/image).
