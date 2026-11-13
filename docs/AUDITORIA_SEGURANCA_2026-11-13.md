# Auditoria de segurança — H&H IMPORTS

Data: 13/11/2026. Base examinada: `0e6fbb291af9ffbd528f3c0b8a0591ae9be43307`.

Foram examinados o código da aplicação, as migrações, as permissões efetivas do banco de produção, o Storage e os metadados/configurações acessíveis da Vercel. As correções deste documento estão implementadas nos arquivos completos do repositório; os links abaixo permitem revisar o código final. Os quatro scripts SQL já foram aplicados no projeto Supabase da loja.

Não foi identificada exploração em andamento. O trabalho encontrou falhas reproduzíveis de lógica de negócio e de contenção de recursos, além de oportunidades de defesa adicional. Uma auditoria pontual não prova ausência de todas as vulnerabilidades nem certifica conformidade PCI DSS. Não houve compra de etiquetas, estorno real ou envio de mensagens a clientes durante os testes.

## Achados e correções

As linhas da coluna “Antes” referem-se ao commit base, evitando confundir a localização da falha com as linhas deslocadas pelas correções.

| ID / severidade | Antes / vetor de ataque | Correção e código final |
| --- | --- | --- |
| SEC-01 — Médio, confirmado | `lib/cupons.ts:6` e `app/api/checkout/route.ts:93`. A elegibilidade de primeira compra consultava apenas pedidos já pagos. Três checkouts concorrentes da mesma conta conseguiam reservar o benefício antes da confirmação do primeiro. O teste reproduziu três respostas 200. | O servidor identifica o benefício e a função SQL verifica a reserva dentro da transação, sob o mesmo bloqueio do cliente usado pelo checkout. Agora há uma resposta 200 e duas 409. Repetir a mesma chave idempotente continua permitido; cancelar/expirar uma reserva sem pagamento permite uma nova tentativa. Arquivos: [cupons](../lib/cupons.ts), [checkout](../app/api/checkout/route.ts), [migração atômica](../supabase/migrations/20261113191144_cupom_primeira_compra_atomico.sql). |
| SEC-02 — Médio, confirmado | `app/api/pedidos/[id]/pagamento/route.ts:15`. Um cliente autenticado podia repetir consultas do próprio pedido ao Mercado Pago sem uma cota por conta, especialmente informando um ID de pagamento. Não permite aprovar pagamento falso, mas permite consumo excessivo de API e recursos. | Limite persistente de 30 consultas/minuto por conta antes da chamada externa. A propriedade do pedido continua obrigatória. Foram adicionadas cotas também à retomada de pagamento, cupom, rastreio, cadastro e operações administrativas. Arquivos: [consulta de pagamento](../app/api/pedidos/[id]/pagamento/route.ts), [segurança](../lib/seguranca.ts) e rotas relacionadas no histórico deste commit. |
| SEC-03 — Médio, contenção de recursos | `app/api/uploads/route.ts:11`. O multipart era interpretado antes da cota de requisições; a proteção inicial dependia do Content-Length. Requisições sem esse cabeçalho podiam consumir trabalho antes da limitação. O limite de corpo da Vercel reduz a dimensão do risco em produção. | Leitura incremental com teto real em bytes, interrupção do stream, cota antes da leitura e validação do tipo multipart. JSON e contato também usam leitura limitada. Mantidas a decodificação/regravação com Sharp, remoção de metadados, teto de pixels, autorização por item e reserva transacional de fotos. Arquivos: [uploads](../app/api/uploads/route.ts), [leitor limitado](../lib/seguranca.ts), [webhook](../app/api/webhooks/mercadopago/route.ts). |
| SEC-04 — Médio, reprodução de sessão | `app/api/auth/[...nextauth]/route.ts:32`. O logout removia o cookie do navegador, mas uma cópia previamente roubada do JWT podia continuar válida até o vencimento de oito horas. Isso pressupõe um comprometimento anterior do token. | Evento de logout incrementa a versão da sessão no banco usando comparação da versão anterior. Todas as APIs verificam essa versão. O navegador confirmou que o mesmo cookie capturado passa de acesso válido para 401 após Sair. Um logout antigo repetido não invalida uma versão mais nova. Arquivos: [NextAuth](../app/api/auth/[...nextauth]/route.ts), [revogação](../lib/seguranca.ts), [autorização](../lib/autorizacao.ts). |
| SEC-05 — Baixo, diferença observável de tempo | `app/api/auth/recuperar/route.ts:13` e `app/api/register/route.ts:16`. Respostas eram genéricas, mas só contas existentes/elegíveis aguardavam SMTP. Um observador podia comparar a latência de várias tentativas para inferir cadastro. | Envio colocado em `after()` e resposta genérica independente da espera pelo SMTP. Não se afirma tempo matematicamente constante para rede/banco. Cotas e tokens de uso único continuam ativos. Arquivos: [recuperação](../app/api/auth/recuperar/route.ts), [cadastro](../app/api/register/route.ts). |
| SEC-06 — Médio, configuração de objetos futuros | `pg_default_acl` de produção: novos objetos criados por `postgres` em `public` herdavam permissões para `anon`/`authenticated`; funções também possuem EXECUTE global implícito de PUBLIC. As tabelas/funções atuais já estavam fechadas. Uma futura migração sem ACL/RLS correta poderia reabrir dados/operações. | Padrão fechado para novas tabelas, sequências e funções do papel do deploy. O backend conserva acesso explícito por `service_role`. A revogação global de EXECUTE remove o padrão implícito de PUBLIC; as concessões do schema public também são revogadas. [Migração](../supabase/migrations/20261113193709_public_default_deny.sql). |
| SEC-07 — Alto se houver credencial real compartilhada; risco condicional, sem vazamento comprovado | Vercel → Environment Variables: existia uma entrada `SUPABASE_SERVICE_ROLE_KEY` em Preview. Metadados não provam que seu valor era válido ou igual ao de Production; nenhum valor foi descriptografado ou comparado. Uma chave real em build de código não confiável seria acessível ao próprio build, mesmo com bloqueio posterior no runtime. | A entrada de Preview foi substituída por um marcador que deliberadamente não é credencial de banco. Production e Development não foram alterados. O bloqueio de operações privadas em Preview já existe em [supabase-admin](../lib/supabase-admin.ts). Não é necessário token novo para clientes da loja. |

## Reforços preventivos adicionais

- **Storage:** as três políticas anteriores eram RESTRICTIVE. Sem uma política permissiva elas já negavam a escrita; não houve confirmação de upload anônimo liberado. A [migração de Storage](../supabase/migrations/20261113190459_storage_acesso_restrito.sql) agora nega explicitamente INSERT/UPDATE/DELETE de `anon` e `authenticated` em todos os buckets e protege a leitura do bucket privado de devoluções mesmo diante de um ALLOW futuro acidental. `joias` continua público para imagens de catálogo; `devolucoes` continua privado. Ambos têm MIME e tamanho máximo configurados. Nenhum arquivo foi excluído ou movido.
- **Minimização em avaliações:** o campo `comprador_id` é um HMAC por produto, não o ID direto do cliente. Ainda assim, a vitrine não precisa recebê-lo. A [migração de colunas públicas](../supabase/migrations/20261113194059_avaliacoes_colunas_publicas.sql) concede somente os seis campos públicos utilizados na leitura/filtro/ordenação; identificador interno, foto não utilizada e colunas futuras permanecem privados. A consulta explícita existente em [Avaliacoes](../components/Avaliacoes.tsx) continua funcionando.
- **CSRF:** SameSite e a verificação anterior de Origin já existiam. [validarOrigem](../lib/autorizacao.ts) também recusa `Sec-Fetch-Site: cross-site` e exige Referer local quando uma mutação com cookies chega sem Origin. Não confia em `X-Forwarded-Host` arbitrário. A validação considera Host para compatibilidade com a normalização de URL interna do Next. Clientes Bearer sem cookie continuam sujeitos à autenticação, sem depender de cookie automático.
- **Erros e logs:** removidos textos brutos de exceções de fornecedor em respostas/logs genéricos de API, webhook e manutenção. Mensagens públicas de validação continuam úteis, sem stack ou detalhes internos. Mantido registro genérico das falhas para diagnóstico.

## Banco e autenticação: resultado efetivo

| Superfície | Resultado verificado em produção |
| --- | --- |
| Tabelas de `public` | 23 tabelas, todas com RLS ativa. Nenhuma permite escrita direta de anon/authenticated. |
| Catálogo | `produtos`, `categorias` e `loja_navegacao` mantêm leitura pública. |
| Avaliações | Leitura pública somente das colunas `id`, `created_at`, `usuario_nome`, `nota`, `comentario`, `produto_id`. Escrita somente pela API autorizada após compra entregue. |
| Dados privados | Usuários, pedidos, endereços, cupons, devoluções, filas, reembolsos e configurações privadas sem grants diretos para anon/authenticated. |
| Funções SQL públicas | 59 funções; zero com EXECUTE concedido a anon/authenticated. As quatro SECURITY DEFINER permanecem sem execução pública. |
| Objetos futuros | Defaults fechados para objetos criados por `postgres`, que é o dono atual de todas as tabelas, sequências e funções da aplicação em `public`. Defaults do papel gerenciado `supabase_admin` não foram alterados; esse papel não pertence ao usuário da integração. Migrações feitas por outro dono exigem ACL explícita. |
| Storage | Catálogo público; devoluções privadas; escrita via backend com autorização. Sem fotos antigas de devolução no prefixo `trocas/` do bucket público na consulta de inventário realizada. |
| Advisors | Apenas 19 avisos INFO de RLS ativa sem política, esperados nas tabelas privadas fechadas. Nenhum WARN/ERROR de segurança retornado pela ferramenta na consulta realizada. |
| Autenticação da loja | NextAuth e tabela privada `usuarios`, com confirmação de e-mail, senha hash bcrypt, versão de sessão e bloqueio de conta verificados no servidor. Um JWT do Supabase Auth não autentica a loja nem abre as tabelas privadas. |
| Administrador | Papel lido do banco e MFA exigido nas APIs administrativas. MFA cifrado com AES-256-GCM; consumo de TOTP/backup protegido contra repetição. |

A regra de usabilidade solicitada foi preservada: clientes com mínimo de oito caracteres e confirmação por e-mail; administradores com regra mais forte e autenticador. O logout passa a encerrar **todas as sessões daquela conta**, pois a versão é por usuário. Isso é intencional e não altera senhas nem dados de pedidos.

## Carrinho, pagamentos, cancelamentos e fraudes

Foram revisados e exercitados os seguintes limites de confiança:

- Preços, estoque, descontos, saldo de créditos e frete são recalculados no servidor. Valores declarados pelo navegador não aprovam cobrança nem estoque.
- Cotação de frete assinada é vinculada à sacola, destino e serviço; adulteração é recusada. Frete grátis não transforma preço de etiqueta em valor confiado ao cliente.
- Checkout possui chave idempotente, bloqueios transacionais, reserva de estoque e limite de pedidos pendentes. O benefício de primeira compra agora participa da reserva atômica.
- IDs de pedido, endereço, foto, devolução e pagamento são associados ao usuário autenticado. Papel/ID enviados pelo cliente não substituem a identidade da sessão.
- Retorno do navegador e corpo do webhook não confirmam pagamento por conta própria. A aplicação verifica o pagamento na API autenticada do Mercado Pago e confere referência, moeda e valor.
- Repetir webhook, cron, compra de etiqueta ou tentativa de reembolso não deve duplicar efeitos financeiros. Testes cobrem idempotência, concorrência, timeout e retomada.
- Pedido enviado/entregue, postagem/rastreio e compra de etiqueta em situação incompatível bloqueiam o cancelamento direto. Pedido em cancelamento não entra em expedição; a disputa entre cancelamento e compra de etiqueta é protegida pelas transações existentes. Devolução após recebimento continua sendo outro fluxo.
- Falha de estorno mantém acompanhamento e não apresenta reembolso concluído. Confirmação financeira real precede devolução de estoque/créditos e finalização do cancelamento.
- Código privado de retirada é exigido, com limitação de tentativas; apenas gerar etiqueta ou marcar preparação não comprova entrega ao cliente.

Não foi confirmado SQL injection, XSS executável ou IDOR nos caminhos examinados e nos testes realizados. O projeto usa PostgreSQL, não NoSQL. Consultas pelo SDK e argumentos de RPC são parametrizados; o adaptador administrativo valida recursos, colunas e operações. React escapa textos exibidos e os templates de e-mail escapam conteúdo variável. Isso não equivale a uma prova formal para toda entrada possível.

## Verificação e reprodução

Os novos cenários estão em [tests/auditoria-ecossistema.test.cjs](../tests/auditoria-ecossistema.test.cjs). Eles usam PostgreSQL local via PGlite e fornecedores simulados, sem credenciais ou valores financeiros de produção.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Evidências desta execução:

- Suíte: 212 testes, incluindo dez novos cenários de segurança; zero falhas após as correções.
- TypeScript, lint e build de produção aprovados. O build local foi executado com configuração de testes e chamadas externas redirecionadas para fornecedores simulados.
- Navegador: 54 verificações de compra, retirada, cancelamento, falha/retomada de reembolso, origem, limites de corpo e revogação de JWT; zero exceções JavaScript e zero alertas nativos no fluxo. Telas verificadas em 320 px, iPhone 14 e desktop.
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas retornadas na execução; isso não detecta falhas inéditas nem substitui revisão de lógica.
- Varredura de padrões de segredo em 35 commits e 668 blobs de texto únicos: nenhum achado nos padrões pesquisados. Valores de ambiente não foram impressos nem incluídos neste relatório.
- Após cada migração foram consultados os privilégios efetivos. A projeção pública de avaliações foi executada como papel anon, sem ler conteúdo de clientes.

## Entorno e limitações que permanecem

1. **Firewall da Vercel:** a integração recusou a consulta à configuração ativa por falta de permissão. O fallback CLI não possuía autenticação. Portanto, regras personalizadas de WAF/rate limit de borda não foram auditadas nem modificadas. Reautorizar a conexão com acesso de proprietário permite concluir essa parte. Limites persistentes da aplicação já foram implementados independentemente disso.
2. **Deploys históricos:** mudar uma variável afeta builds futuros; deploys imutáveis antigos podem preservar sua configuração anterior. Se algum Preview executou código não confiável com chaves reais, é necessário revogar esses deploys e rotacionar as respectivas credenciais. Não há evidência obtida de exfiltração, e não foi feita comparação secreta entre chaves dos ambientes. Novos previews usam o marcador sem acesso administrativo ao banco; dados privados já são bloqueados no runtime de Preview.
3. **Separação de ambientes:** para habilitar operações privadas em Preview/Development, usar projeto Supabase e chaves de pagamento exclusivos de teste. Não reutilizar produção. Não alterei a configuração de Development nesta auditoria.
4. **Supabase Auth gerenciado:** a loja usa NextAuth. Configurações de painel do Supabase Auth (SMTP, provedores e opções gerais) não são expostas pela conexão utilizada; não se declara uma inspeção completa dessas opções. Mesmo um usuário criado diretamente no Auth gerenciado permanece sem privilégios nas tabelas privadas e sem sessão NextAuth válida.
5. **Contas dos fornecedores:** 2FA da conta GitHub/Vercel/Supabase/Mercado Pago/Melhor Envio, proteção física de dispositivos, permissões da organização, recuperação de conta e restauração de backups exigem gestão operacional contínua. Não foram alteradas contas ou credenciais de produção indiscriminadamente.
6. **Disponibilidade:** rate limiting reduz abuso de aplicação; não substitui mitigação de DDoS na plataforma. O teto de payload e as cotas também devem ser respeitados por eventuais proxies adicionados no futuro.
7. **PCI DSS:** o checkout redireciona para o Mercado Pago; a loja não deve coletar nem armazenar PAN/CVV. Não foram encontrados esses campos no código de app/componentes/lib pesquisado. O redirecionamento reduz o contato com dados de cartão, mas não dispensa automaticamente obrigações da loja. Escopo, questionário aplicável, validação do provedor e eventual varredura ASV precisam ser confirmados com adquirente/provedor ou profissional responsável. Esta auditoria não é certificação PCI.

Os cabeçalhos existentes foram mantidos: CSP com nonce, `frame-ancestors 'none'`, X-Frame-Options DENY, nosniff, HSTS, Referrer-Policy e Permissions-Policy. Não há servidor Express que justifique acrescentar Helmet; aplicar cabeçalhos pelo Next/Vercel atende esse ponto da arquitetura. APIs privadas não foram abertas por CORS.

## Referências primárias

- [OWASP Top 10:2025 — Broken Access Control](https://top10.owasp.org/2025/A01_2025-Broken_Access_Control/)
- [OWASP — Top 10 for Business Logic Abuse](https://owasp.org/projects/top-10-for-business-logic-abuse)
- [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [PostgreSQL — ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)
- [Vercel — Request headers](https://vercel.com/docs/headers/request-headers)
- [PCI SSC — SAQ A e critérios relativos a scripts](https://www.pcisecuritystandards.org/faqs/1588/)
- [PCI SSC — Varreduras externas ASV e SAQ A](https://www.pcisecuritystandards.org/faqs/1604/)
