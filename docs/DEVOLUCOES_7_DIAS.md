# Prazo de devolução por arrependimento

A conta do cliente oferece ações distintas:

- **Devolver (7 dias):** disponível até o fim do 7º dia corrido contado a partir do dia seguinte ao recebimento, no calendário de Joinville (`America/Sao_Paulo`). Após o prazo, o botão mostra **Prazo encerrado** e fica desativado.
- **Relatar defeito:** permanece disponível para análise de garantia, independentemente do encerramento do prazo de arrependimento. A foto do defeito continua obrigatória.
- **Entrega a confirmar:** pedidos antigos sem data real não são classificados como vencidos pela data da compra. O cliente pode registrar a solicitação com o atendimento; a data deve ser conferida no admin.

## Registrar recebimento

Em **Admin → Pedidos → Ver Detalhes**, selecione **Entregue**, preencha **Data real de recebimento pelo cliente** e salve. A data é obrigatória na tela e não pode estar no futuro. Para pedidos antigos já entregues, preencha a data real após conferência. Não use a data de criação do pedido como substituta da entrega.

A data é persistida como `data_recebimento` nos itens privados do pedido. A API apresenta `data_entrega` como um campo calculado para a interface. Não há migração nem alteração de estrutura no Supabase, e pedidos antigos permanecem sem data até a conferência. As edições de rastreio/status preservam a data já registrada.

## Proteções

- A tela mostra recebimento e limite e reavalia o prazo enquanto a aba/modal permanece aberta ou quando o usuário volta para a página.
- A API consulta o pedido da pessoa autenticada e usa a data persistida, ignorando datas enviadas pelo navegador.
- Clientes não podem escrever diretamente em pedidos/trocas: as permissões e o RLS existentes exigem os fluxos autenticados da API. Somente o admin registra o recebimento; a gravação preserva produto, preço, quantidade e endereço do pedido.
- Pedidos por preferência de tamanho seguem o prazo de arrependimento; defeitos são analisados por um fluxo separado, sem bloqueio automático de sete dias.
- Solicitações já registradas continuam passíveis de análise depois do prazo; o bloqueio se aplica à abertura de novos pedidos de arrependimento.
- As permissões e políticas de RLS de pedidos, usuários e trocas permanecem privadas.

## Validação

Testes de calendário cobrem o fim exato do 7º dia, virada de mês/ano, ano bissexto e datas ausentes/inválidas/futuras. Testes de API com Postgres isolado cobrem aceitação no último dia, recusa no 8º, data forjada no corpo, duplicidade, pedidos de terceiros, defeitos com foto e manutenção de datas históricas desconhecidas. Testes administrativos verificam o registro da data nos itens, a preservação de preço/quantidade e a recusa de datas futuras ou alteração indevida dos itens comerciais.

Referências: [CDC, arts. 26 e 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm) e [orientações do Procon-SP sobre contagem do prazo](https://www.procon.sp.gov.br/aviso-ao-consumidor/).
