# Prazo de devolução por arrependimento

A conta do cliente oferece ações distintas:

- **Devolver (7 dias):** disponível até o fim do 7º dia corrido contado a partir do dia seguinte ao recebimento, no calendário de Joinville (`America/Sao_Paulo`). Após o prazo, o botão mostra **Prazo encerrado** e fica desativado.
- **Relatar defeito:** permanece disponível para análise de garantia, independentemente do encerramento do prazo de arrependimento. A foto do defeito continua obrigatória.
- **Entrega a confirmar:** pedidos antigos sem data real não são classificados como vencidos pela data da compra. O cliente pode registrar a solicitação com o atendimento; a data deve ser conferida no admin.

## Recebimento automático

Pedidos com etiqueta gerada pela integração e rastreio vinculado são conferidos automaticamente no Melhor Envio. Somente `status: delivered` com `delivered_at` válido registra **Entregue** e a data real nos itens. A conversão considera o calendário de Joinville. Postagem, chegada a um ponto Pegaki, tentativa de entrega e datas previstas não iniciam o prazo.

- O cron protegido `/api/cron/entregas` executa diariamente, programado para 13h UTC (10h de Brasília; a Vercel pode variar o horário no plano Hobby).
- A conta do cliente e o painel também conferem pedidos em trânsito em segundo plano ao abrir e enquanto a tela estiver visível, a cada 15 minutos e ao retornar à janela. Os pedidos aparecem antes da consulta externa; havendo entrega, a lista se atualiza automaticamente.
- Cada etiqueta respeita intervalo mínimo de 15 minutos entre consultas. O cron e o admin consultam até 30 etiquetas por execução, priorizando as menos recentemente conferidas, com cinco requisições simultâneas. A conta consulta até cinco etiquetas próprias por execução. Em volumes maiores, aumente a frequência do cron em plano compatível e monitore o retorno `consultadas/entregues/falhas`.
- Usa `MELHOR_ENVIO_TOKEN` e `CRON_SECRET` já configurados, sem novo token. A consulta é somente leitura no provedor e usa o UUID da etiqueta, sem comprar ou gerar outro frete. Sandbox não confirma entregas de produção.
- Status e recebimento são gravados juntos. O trigger existente registra o e-mail de entrega uma única vez; falhas de envio ficam na fila de notificações. Repetições preservam a data e não reiniciam os sete dias.
- A detecção depende da atualização da transportadora e da próxima consulta; não é instantânea. Pedidos antigos sem etiqueta vinculada, respostas sem data real e dados inconsistentes exigem conferência manual. A data da compra ou da consulta nunca substitui o recebimento.

Referências da integração: [informações da etiqueta](https://docs.melhorenvio.com.br/reference/listar-informacoes-de-uma-etiqueta) e [eventos e datas do Melhor Envio](https://docs.melhorenvio.com.br/docs/webhooks).

## Conferência manual e correções

Em **Admin → Pedidos → Ver Detalhes**, selecione **Entregue**, preencha **Data real de recebimento pelo cliente** e salve. A data é obrigatória na tela e não pode estar no futuro. Para pedidos antigos já entregues, preencha a data real após conferência. Não use a data de criação do pedido como substituta da entrega.

A data é persistida como `data_recebimento` nos itens privados do pedido. Recebimentos automáticos incluem a origem e o instante informado pelo provedor para auditoria; correções manuais passam a ser identificadas como manuais. A API apresenta `data_entrega` como um campo calculado para a interface. Não há migração nem alteração de estrutura no Supabase, e pedidos antigos permanecem sem data até a conferência. As edições de rastreio/status preservam a data já registrada e formulários concorrentes não sobrescrevem uma entrega recém-confirmada.

## Proteções

- A tela mostra recebimento e limite e reavalia o prazo enquanto a aba/modal permanece aberta ou quando o usuário volta para a página.
- A API consulta o pedido da pessoa autenticada e usa a data persistida, ignorando datas enviadas pelo navegador.
- Clientes não podem escrever diretamente em pedidos/trocas: as permissões e o RLS existentes exigem os fluxos autenticados da API. O servidor confirma entregas no provedor e o admin pode conferir/corrigir o recebimento; a gravação preserva produto, preço, quantidade e endereço do pedido.
- Pedidos por preferência de tamanho seguem o prazo de arrependimento; defeitos são analisados por um fluxo separado, sem bloqueio automático de sete dias.
- Solicitações já registradas continuam passíveis de análise depois do prazo; o bloqueio se aplica à abertura de novos pedidos de arrependimento.
- As permissões e políticas de RLS de pedidos, usuários e trocas permanecem privadas.

## Validação

Testes de calendário cobrem o fim exato do 7º dia, virada de mês/ano, ano bissexto e datas ausentes/inválidas/futuras. Testes de API com Postgres isolado cobrem aceitação no último dia, recusa no 8º, data forjada no corpo, duplicidade, pedidos de terceiros, defeitos com foto e manutenção de datas históricas desconhecidas. Testes administrativos verificam o registro da data nos itens, a preservação de preço/quantidade e a recusa de datas futuras ou alteração indevida dos itens comerciais.

Referências: [CDC, arts. 26 e 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm) e [orientações do Procon-SP sobre contagem do prazo](https://www.procon.sp.gov.br/aviso-ao-consumidor/).
