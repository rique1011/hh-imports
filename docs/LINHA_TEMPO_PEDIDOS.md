# Data e horário dos pedidos

A conta do cliente apresenta as etapas Realizado, Pagamento aprovado, Preparando, Enviado e Entregue com data e hora no fuso de Brasília (`America/Sao_Paulo`). No celular a lista é vertical para não exigir rolagem horizontal; em telas maiores as cinco etapas ficam lado a lado.

As fontes são registros privados já existentes:

- **Realizado:** `pedidos.created_at`.
- **Pagamento aprovado e Enviado:** `pedido_notificacoes.criado_em`, ou seja, o instante da primeira confirmação registrada pela loja. Não se usa `enviada_em`, porque o e-mail pode sair posteriormente. Esse horário não pretende substituir o instante bancário original do Mercado Pago.
- **Preparando:** `preparacao_iniciada_em`, registrado pelo servidor nos itens quando o admin muda de um status pago para Processando. Repetir o status preserva o primeiro registro; comprar uma etiqueta automaticamente não inventa um início de separação física.
- **Entregue:** instante real da transportadora salvo pela conferência automática. Recebimentos manuais com apenas a data exibem o dia e “Horário não registrado”. Uma correção manual não reaproveita o horário anterior da transportadora.

Etapas futuras mostram “Aguardando”. Para etapas passadas sem registro, a interface mostra “Horário não registrado”; não copia o horário da compra para os demais eventos. Histórico antigo continua disponível mesmo quando incompleto. Aprovação de pagamento e preparação são etapas distintas.

As APIs consultam primeiro os pedidos da pessoa autenticada e só então os horários desses pedidos. A consulta é em lotes, com projeção apenas de evento e horário; nenhum destinatário, erro ou payload de e-mail é exportado. Falha ao obter horários mantém a consulta principal do pedido disponível. Não há migração ou nova permissão pública no Supabase.

# Atividade diária no Supabase Free

O `vercel.json` já programa três rotinas de produção, todas protegidas por `CRON_SECRET`:

| Rotina | Agendamento UTC | Horário de Brasília | Consulta ao banco |
| --- | --- | --- | --- |
| Notificações | 10h diariamente | 7h | Fila persistente de notificações e etiquetas pendentes |
| Envios | 11h diariamente | 8h | Reserva e consulta da fila de expedição automática |
| Entregas | 13h diariamente | 10h | Consulta das etiquetas em trânsito, com o token do Melhor Envio configurado |

No Hobby, a Vercel pode executar dentro da hora agendada. Essas rotinas úteis já geram atividade mesmo sem compras novas; não é necessário criar outro cron apenas para ping. Verifique em **Vercel → Projeto → Settings → Cron Jobs** se as rotinas estão habilitadas e consulte as execuções recentes. Não compartilhe `CRON_SECRET` nem chaves do Supabase com monitoradores públicos.

O Supabase informa que pouca atividade durante sete dias pode pausar projetos Free. Algumas consultas por dia costumam ser suficientes, mas não garantem que o projeto não seja pausado. Acompanhe os avisos por e-mail; planos pagos não sofrem pausa por inatividade. Nenhuma alteração de plano foi feita.

Referências: [pausa no Supabase Free](https://supabase.com/docs/guides/platform/free-project-pausing) e [agendamentos da Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing).

O horário da aprovação usa `pagamento.aprovado_em`, obtido da API autenticada do Mercado Pago. Pedidos anteriores continuam usando o instante da confirmação persistido na fila. O quarto cron diário, `/api/cron/pagamentos`, concilia às 12h UTC. Veja [Conta e checkout](CONTA_E_CHECKOUT.md).
