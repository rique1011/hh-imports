import 'server-only'
import nodemailer from 'nodemailer'
import { BRAND_NAME, CONTACT_EMAIL } from '@/lib/brand'
import { getSiteUrl } from '@/lib/site-url'

export interface PedidoEmail {
  id: string | number
  cliente_email: string
  cliente_nome: string
  total: number | string
  status?: string
  codigo_rastreio?: string | null
  itens?: { nome: string; quantidade: number; preco?: number }[]
}

export type ResultadoEmail =
  | { sucesso: true; messageId: string }
  | { sucesso: false; error: string }

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined

export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

function getTransporter() {
  if (transporter) return transporter
  const user = process.env.EMAIL_USER?.trim()
  const pass = process.env.EMAIL_PASS?.replace(/\s/g, '')
  if (!user || !pass) throw new Error('Configure EMAIL_USER e EMAIL_PASS (senha de app do Gmail).')
  transporter = nodemailer.createTransport({
    service: 'gmail', auth: { user, pass },
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
  })
  return transporter
}

function money(value: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function resumoPedido(pedido?: PedidoEmail) {
  if (!pedido) return ''
  const itens = (pedido.itens || []).map(item =>
    '<li>' + escapeHtml(item.quantidade) + ' × ' + escapeHtml(item.nome) + '</li>'
  ).join('')
  return '<p><strong>Pedido #' + escapeHtml(pedido.id) + '</strong><br>Total: ' +
    escapeHtml(money(pedido.total)) + '</p>' + (itens ? '<ul>' + itens + '</ul>' : '')
}

function layout(content: string) {
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#333">' +
    '<h1 style="background:#111;color:#D4AF37;padding:24px;text-align:center;letter-spacing:3px">' +
    escapeHtml(BRAND_NAME) + '</h1>' + content +
    '<hr><p style="font-size:12px;color:#777">' + escapeHtml(BRAND_NAME) +
    ' · ' + new Date().getFullYear() + '<br><a href="mailto:' + escapeHtml(CONTACT_EMAIL) + '">' +
    escapeHtml(CONTACT_EMAIL) + '</a></p></div>'
}

export async function enviarEmailLoja(to: string, subject: string, content: string, replyTo = CONTACT_EMAIL): Promise<ResultadoEmail> {
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Destinatario de e-mail invalido.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) throw new Error('Contato de resposta inválido.')
    const html = layout(content)
    const info = await getTransporter().sendMail({
      from: { name: BRAND_NAME, address: process.env.EMAIL_USER!.trim() },
      to, replyTo, subject: BRAND_NAME + ' | ' + subject,
      html,
      text: html.replace(/<(br|\/p|\/li|\/h1)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    })
    if (!info.accepted?.some((address: string | {address:string}) => String(address).toLowerCase() === to.toLowerCase())) {
      throw new Error('O servidor SMTP nao aceitou o destinatario.')
    }
    return { sucesso: true, messageId: info.messageId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no envio de e-mail.'
    console.error('[email] Falha no envio:', message)
    return { sucesso: false, error: message }
  }
}
const enviar = enviarEmailLoja

export async function enviarEmailContato(nome: string, email: string, mensagem: string) {
  return enviarEmailLoja(CONTACT_EMAIL, 'Mensagem pelo site',
    '<p>Contato de <strong>' + escapeHtml(nome) + '</strong><br>E-mail: ' + escapeHtml(email) + '</p>' +
    '<p>' + escapeHtml(mensagem).replace(/\r?\n/g, '<br>') + '</p>', email)
}

export async function enviarEmailPedidoRecebido(pedido: PedidoEmail) {
  const pago = ['pago', 'confirmado', 'enviado', 'entregue'].includes(pedido.status || '')
  return enviar(pedido.cliente_email, 'Pedido #' + pedido.id + ' recebido',
    '<p>Olá, <strong>' + escapeHtml(pedido.cliente_nome) + '</strong>!</p>' +
    '<p>Recebemos seu pedido. ' + (pago ? 'O pagamento está confirmado.' : 'Aguardamos a confirmação do pagamento.') +
    '</p>' + resumoPedido(pedido))
}

export async function enviarEmailStatus(
  email: string, nome: string, status: string, dadoExtra?: string, pedido?: PedidoEmail
): Promise<ResultadoEmail> {
  const saudacao = '<p>Olá, <strong>' + escapeHtml(nome) + '</strong>!</p>'
  const resumo = resumoPedido(pedido)
  let subject: string
  let content: string
  switch (status.toLowerCase()) {
    case 'approved':
    case 'pago':
    case 'confirmado':
      subject = 'Pagamento aprovado' + (pedido ? ' — Pedido #' + pedido.id : '')
      content = saudacao + '<p>Seu pagamento foi confirmado. Vamos separar e preparar seu produto para envio.</p>' + resumo
      break
    case 'postado':
    case 'enviado':
      subject = 'Pedido enviado' + (pedido ? ' — #' + pedido.id : '')
      content = saudacao + '<p>Seu pedido foi despachado.</p>' + resumo +
        (dadoExtra ? '<p>Código de rastreio: <strong>' + escapeHtml(dadoExtra) + '</strong></p>' : '') +
        '<p><a href="' + escapeHtml(getSiteUrl('/minha-conta')) + '">Acompanhar pedido</a></p>'
      break
    case 'entregue':
      subject = 'Pedido entregue' + (pedido ? ' — #' + pedido.id : '')
      content = saudacao + '<p>Seu pedido foi marcado como entregue. Obrigado por comprar na ' + escapeHtml(BRAND_NAME) + '!</p>' + resumo
      break
    case 'troca_aprovada':
      subject = 'Troca aprovada — Código de postagem'
      content = saudacao + '<p>Sua troca foi aprovada. Apresente este código nos Correios:</p>' +
        '<p><strong>' + escapeHtml(dadoExtra) + '</strong></p>'
      break
    case 'recuperacao':
      subject = 'Recuperação de senha'
      content = saudacao + '<p>O link abaixo é válido por uma hora.</p><p><a href="' +
        escapeHtml(getSiteUrl('/redefinir-senha') + '?token=' + encodeURIComponent(dadoExtra || '')) +
        '">Redefinir senha</a></p><p>Se você não solicitou a alteração, ignore este e-mail.</p>'
      break
    default:
      return { sucesso: false, error: 'Status de e-mail invalido.' }
  }
  return enviar(email, subject, content)
}

export async function notificarAdminNovoPedido(pedido: PedidoEmail) {
  return enviar(process.env.ADMIN_EMAIL?.trim() || CONTACT_EMAIL,
    'Novo pedido recebido — #' + pedido.id,
    '<p>Um novo pedido foi criado na loja.</p>' + resumoPedido(pedido) +
    '<p>Cliente: ' + escapeHtml(pedido.cliente_nome) + '<br>E-mail: ' + escapeHtml(pedido.cliente_email) +
    '</p><p>Status: ' + escapeHtml(pedido.status || 'pendente') + '</p>')
}

export async function notificarAdminPagamentoAprovado(pedido: PedidoEmail) {
  if (pedido.status === 'pagamento_em_analise') return enviar(process.env.ADMIN_EMAIL?.trim() || CONTACT_EMAIL,
    'Pagamento recebido — Conferência necessária — #' + pedido.id,
    '<p>O pagamento foi confirmado depois da liberação da reserva. Confira estoque e cashback antes de preparar ou enviar. A expedição automática está suspensa.</p>' + resumoPedido(pedido))
  return enviar(process.env.ADMIN_EMAIL?.trim() || CONTACT_EMAIL,
    'Pagamento confirmado — Hora de separar o produto — #' + pedido.id,
    '<p><strong>Pagamento aprovado. Separe o produto para envio.</strong></p>' +
    resumoPedido(pedido) + '<p>Cliente: ' + escapeHtml(pedido.cliente_nome) +
    '<br>E-mail: ' + escapeHtml(pedido.cliente_email) + '</p>')
}
