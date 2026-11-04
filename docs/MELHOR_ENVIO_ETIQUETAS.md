# Etiquetas Melhor Envio — H&H IMPORTS

Implementação de 04/11/2026 para `rique1011/hh-imports`, baseada no commit `6219be7`.

## Resultado da análise do frete

O carrinho já consultava `/api/frete`, que chamava a API real do Melhor Envio. Uma chamada de cotação em produção, antes desta alteração, retornou HTTP 200 e 12 opções; nenhuma etiqueta foi comprada nesse teste. O preço não era uma tarifa fixa, mas a embalagem era fixa em 0,15 kg e 11×3×16 cm, o seguro era zero, e o pedido não preservava serviço/volumes ou endereço de entrega.

A correção usa `volumes`, considera quantidades, assegura o valor dos produtos e utiliza `custom_price`/`custom_delivery_time` quando retornados. As medidas por unidade embalada são configuráveis. A assinatura da cotação inclui itens, quantidades, preços, CEPs, ambiente, serviço e volume; vale por 15 minutos. O checkout usa preços do catálogo e persiste endereço/cotação atomicamente com a criação do pedido. O frete grátis a partir de R$100 continua vigente: o cliente paga zero, e a loja compra a etiqueta escolhida pelo administrador.

As medidas padrão preservam a unidade embalada usada anteriormente. **Confira as medidas reais antes da primeira etiqueta.** O modelo implementado empilha unidades em um único pacote, somando altura e peso. Pacotes distintos por SKU, múltiplos volumes e layouts de embalagem personalizados exigem outra regra de empacotamento; não foram presumidos.

## Arquivos completos

- API principal: `app/api/melhor-envio/gerar-etiqueta/route.ts`.
- Download/abertura autenticada: `app/api/melhor-envio/etiqueta/route.ts`.
- Painel integrado: `app/admin/pedidos/page.tsx`.
- Componente do botão/formulário: `components/admin/EtiquetaMelhorEnvio.tsx`.
- Compra, checkpoints e retomada: `lib/etiquetas.ts`.
- Cliente HTTP autenticado: `lib/melhor-envio.ts`.
- Destinatário e remetente: `lib/entrega.ts`.
- Cotação: `lib/frete.ts` e `app/api/frete/route.ts`.
- Carrinho e prévia de produto: `app/carrinho/page.tsx`, `components/CalculadorFrete.tsx` e `app/produto/[slug]/page.tsx`.
- Checkout com snapshot: `app/api/checkout/route.ts`.
- Retomada agendada: `app/api/cron/notificacoes/route.ts`.
- DTOs: `types/envio.ts`.
- Migração: `supabase/migrations/20261104235351_melhor_envio_etiquetas.sql`.
- Ambiente: `.env.example`.
- Testes novos: `tests/melhor-envio.test.cjs`; fixtures e testes existentes adaptados em `tests/helpers.cjs`, `tests/notificacoes.test.cjs` e `tests/seguranca.test.cjs`.

## Configuração para ativar a emissão

`MELHOR_ENVIO_TOKEN` e `CEP_ORIGEM` já estavam presentes em Production na conferência de 04/11. Não foram lidos nem publicados os valores dos segredos. `MELHOR_ENVIO_REMETENTE` ainda precisa ser preenchida com dados reais.

Na Vercel, projeto **hh-imports → Settings → Environment Variables → Add**, cadastre `MELHOR_ENVIO_REMETENTE` para **Production**, sem prefixo `NEXT_PUBLIC_`. Use JSON em uma linha, com os valores reais:

```json
{"nome":"Nome da empresa remetente","documento":"CNPJ_APENAS_NUMEROS","telefone":"DDD_E_TELEFONE","logradouro":"Rua da expedicao","numero":"123","complemento":"","bairro":"Bairro","cidade":"Cidade","uf":"SC","inscricao_estadual":"SE_HOUVER"}
```

O CEP vem de `CEP_ORIGEM`. Se `email` não for informado no JSON, usa `EMAIL_USER`. Remova `inscricao_estadual` quando não houver. Use o tipo Secret para os dados privados. Este fluxo é comercial com CNPJ e chave da NF-e; não declara automaticamente mercadorias comerciais como não comerciais.

Confira também:

| Variável | Uso |
|---|---|
| `MELHOR_ENVIO_AMBIENTE` | `production` por padrão; `sandbox` somente com token do sandbox. |
| `MELHOR_ENVIO_LARGURA_CM` | Largura por unidade embalada, padrão 11 cm. |
| `MELHOR_ENVIO_ALTURA_CM` | Altura por unidade embalada, padrão 3 cm. |
| `MELHOR_ENVIO_COMPRIMENTO_CM` | Comprimento por unidade embalada, padrão 16 cm. |
| `MELHOR_ENVIO_PESO_KG` | Peso por unidade embalada, padrão 0,15 kg. |
| `MELHOR_ENVIO_SERVICOS` | Opcional: lista de IDs habilitados, separados por vírgula. Vazio consulta todos. |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP já usado pela fila de notificações. |
| `CRON_SECRET` | Protege o cron já existente. |

O token precisa permitir cotação, carrinho, consulta de etiquetas, checkout, geração e impressão; possuir apenas acesso à cotação não garante permissão para comprar. O checkout utiliza saldo da carteira Melhor Envio. Depois de alterar variáveis, faça um novo deployment para aplicá-las ao runtime.

## Uso no painel

1. Entre como administrador em `/admin/pedidos` e abra os detalhes de um pedido pago/confirmado/processando.
2. Confira o destino mostrado na seção **Etiqueta Melhor Envio**. Em pedidos antigos sem snapshot, o destino vem do cadastro atual e há um aviso.
3. Clique em **Consultar fretes para este pedido**. Quando existe serviço contratado no checkout, ele é preservado; em pedidos antigos ou com frete grátis, escolha o serviço.
4. Informe a chave de **44 dígitos da NF-e desse pedido** e, se a transportadora exigir, o ID da agência de postagem.
5. Confira o custo exibido e clique em **Gerar Etiqueta (Melhor Envio)**. A compra usa saldo real da carteira em produção.
6. Se a compra foi recusada por saldo insuficiente, **Concluir compra da etiqueta** exibe o valor antes da nova tentativa com o mesmo ID. O painel acompanha a geração por até oito consultas automáticas. É possível retomar usando **Atualizar processamento da etiqueta**.
7. Quando o documento estiver gerado, **Abrir etiqueta / PDF** disponibiliza a impressão. O PDF é servido por rota autenticada; quando o fornecedor oferece somente a impressão privada, é preciso estar conectado à mesma conta Melhor Envio no navegador.

Azul e outros serviços com requisitos específicos podem permitir cotação sem permitir compra via API, ou exigir agência/XML fiscal. Nesse caso, a resposta do fornecedor é exibida e o pedido continua disponível para o fluxo manual existente. Não se troca silenciosamente o serviço contratado.

## Contrato HTTP

Todas as rotas abaixo exigem administrador autenticado. POST valida a origem da requisição. A rota pública de cotação recebe somente IDs/quantidades e consulta os preços no servidor.

```http
GET /api/melhor-envio/gerar-etiqueta?pedidoId=123
```

```json
{"pedidoId":123,"acao":"cotar"}
```

```json
{"pedidoId":123,"acao":"gerar","freteToken":"TOKEN_ASSINADO_DA_COTACAO","notaFiscal":"CHAVE_NFE_DE_44_DIGITOS","agencia":""}
```

Envie os JSONs por POST para `/api/melhor-envio/gerar-etiqueta`. A resposta usa HTTP 202 durante o processamento e HTTP 200 quando status/rastreio estão confirmados. Exemplo intermediário:

```json
{"pedidoId":"123","estado":"aguardando_rastreio","codigoRastreio":null,"urlEtiqueta":"/api/melhor-envio/etiqueta?pedidoId=123","custoEtiqueta":17.37,"mensagem":"Etiqueta disponível. Aguardando o código da transportadora para atualizar o pedido e notificar o cliente.","concluido":false,"podeRetomar":true}
```

A geração e a disponibilização de rastreio são assíncronas no fornecedor. O código não fabrica rastreio quando o campo ainda está vazio. Quando ele chega, `hh_finalizar_envio` grava `codigo_rastreio` e `status='enviado'` na mesma transação, preservando `entregue` quando aplicável. O trigger existente registra uma notificação única e o worker `processarNotificacoes` chama **`enviarEmailStatus` de `lib/mail.ts`**, com o código e link da conta para acompanhar. Falha SMTP mantém a notificação persistida para retry, sem desfazer a etiqueta.

O cron diário já existente retoma até duas etiquetas pendentes antes de processar os e-mails. A confirmação automática depende desse agendamento; abrir o painel e atualizar também retoma. Nenhum webhook Melhor Envio adicional foi presumido.

## Proteção contra cobranças duplicadas

Há uma linha privada em `pedido_envios` por pedido, ID Melhor Envio único e lease de três minutos. Cada etapa é persistida antes da chamada externa. O ID e a validação de preço são persistidos juntos antes do checkout. Uma compra com resposta incerta só consulta o mesmo ID; não repete automaticamente o pagamento.

Se a inserção no carrinho perder a resposta e não houver ID confirmado, a operação fica bloqueada para conciliação. Confira o carrinho no Melhor Envio pela tag `HH-PEDIDO-ID`. Não apague o checkpoint para simplesmente tentar de novo. Entre o Postgres e um provedor externo não há transação distribuída; bloquear resultados incertos evita uma promessa falsa de execução única.

A tabela possui RLS, sem grants para `anon`/`authenticated`; as três funções novas são `SECURITY INVOKER`, executáveis apenas por `service_role`. O backend valida administrador pelo cadastro atual. Tokens e dados fiscais ficam no servidor. A migração foi aplicada no Supabase conectado, sem criar pedidos ou etiquetas reais.

## Validação e limites

- ESLint sem avisos, TypeScript e build de produção aprovados.
- 30 testes de backend aprovados: estoque/cashback, autenticação/RLS, compra e geração assíncrona, concorrência, timeouts, saldo insuficiente, preço acima do revisado, snapshot, cotação vinculada à sacola e e-mail único.
- Interface verificada em Chromium com fixtures, incluindo loading, campos obrigatórios, resposta 202 retomada, rastreio, status e link de PDF. A compra e o SMTP usam mocks, não serviços reais.
- A cotação antiga em produção foi verificada com chamada real e sem custo; a primeira compra real de etiqueta precisa ser validada depois de cadastrar remetente, conferir permissões/saldo do token e informar uma NF-e válida.

Referências oficiais consultadas: [cotação](https://docs.melhorenvio.com.br/docs/cotacao-de-fretes), [carrinho](https://docs.melhorenvio.com.br/reference/inserir-fretes-no-carrinho), [compra](https://docs.melhorenvio.com.br/reference/compra-de-fretes-1), [geração](https://docs.melhorenvio.com.br/reference/geracao-de-etiquetas), [impressão PDF](https://docs.melhorenvio.com.br/reference/impressao-de-etiquetas-em-arquivo), [dados fiscais](https://docs.melhorenvio.com.br/docs/compra-de-fretes), [rastreio assíncrono](https://docs.melhorenvio.com.br/docs/webhooks).
