import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { exigirAdmin, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'

interface Consulta extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  eq(campo: string, valor: unknown): Consulta
  gt(campo: string, valor: unknown): Consulta
  in(campo: string, valor: unknown[]): Consulta
  order(campo: string, options: { ascending: boolean }): Consulta
  limit(limite: number): Consulta
  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>
}

type Operacao = 'select' | 'insert' | 'update' | 'delete'
const recursos = {
  produtos: { leitura: 'id,nome,slug,preco,estoque,estoque_reservado,material,descricao,video_url,fotos,categoria_id,categoria_slug,criado_em,visitas', escrita: ['nome','slug','preco','estoque','material','descricao','video_url','fotos','categoria_id','categoria_slug'] },
  pedidos: { leitura: 'id,created_at,cliente_email,cliente_nome,status,total,itens,codigo_rastreio', escrita: ['status','codigo_rastreio'] },
  usuarios: { leitura: 'id,nome,email,cpf_cnpj,whatsapp,endereco,perfil,role', escrita: [] },
  cupons: { leitura: 'id,codigo,desconto,valor_fixo,usuario_id,ativo,criado_em', escrita: ['codigo','desconto','valor_fixo','usuario_id','ativo'] },
  trocas: { leitura: 'id,pedido_id,produto_id,usuario_id,motivo,foto_url,status,criado_em,usuarios(nome,email)', escrita: ['status'] },
} as const

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirAdmin(request)
    const body = await request.json()
    if (!(typeof body.tabela === 'string' && Object.hasOwn(recursos, body.tabela))) throw new ErroHttp(400, 'Recurso inválido.')
    const tabela = body.tabela as keyof typeof recursos
    const regra = recursos[tabela]
    const operacao = body.operacao as Operacao
    if (!['select','insert','update','delete'].includes(operacao)) throw new ErroHttp(400, 'Operação inválida.')
    const filtros = Array.isArray(body.filtros) ? body.filtros : []
    if (filtros.length > 8) throw new ErroHttp(400, 'Filtros inválidos.')
    if (operacao !== 'select' && !regra.escrita.length) throw new ErroHttp(403, 'Recurso somente para leitura.')
    if (operacao === 'insert' && !['produtos','cupons'].includes(tabela)) throw new ErroHttp(403, 'Criação indisponível neste recurso.')
    if (operacao === 'delete' && !['produtos','cupons'].includes(tabela)) throw new ErroHttp(403, 'Exclusão indisponível neste recurso.')
    if (['update','delete'].includes(operacao) && !filtros.some((f: { campo: string; op: string; valor: unknown }) => f.campo === 'id' && f.op === 'eq' && ['string','number'].includes(typeof f.valor))) throw new ErroHttp(400, 'Informe o identificador do registro.')
    let valores = body.valores
    if (['insert','update'].includes(operacao)) {
      const lista = Array.isArray(valores) ? valores : [valores]
      if (lista.length !== 1 || !lista[0] || typeof lista[0] !== 'object') throw new ErroHttp(400, 'Dados inválidos.')
      for (const chave of Object.keys(lista[0])) if (!(regra.escrita as readonly string[]).includes(chave)) throw new ErroHttp(400, 'Campo não permitido: ' + chave)
      if ('preco' in lista[0] && (!Number.isFinite(Number(lista[0].preco)) || Number(lista[0].preco) < 0)) throw new ErroHttp(400, 'Preço inválido.')
      if ('estoque' in lista[0] && (!Number.isSafeInteger(Number(lista[0].estoque)) || Number(lista[0].estoque) < 0)) throw new ErroHttp(400, 'Estoque inválido.')
      if (tabela === 'pedidos') {
        const id = filtros.find((f: { campo: string; op: string }) => f.campo === 'id' && f.op === 'eq')?.valor
        const { data: pedido, error } = await user.db.from('pedidos').select('status').eq('id', id).maybeSingle()
        if (error) throw error
        if (!pedido) throw new ErroHttp(404, 'Pedido não encontrado.')
        const atual = String(pedido.status || '').toLowerCase()
        const proximo = lista[0].status
        const transicoes: Record<string, string[]> = {
          pago: ['processando','enviado','entregue'], confirmado: ['processando','enviado','entregue'],
          processando: ['enviado','entregue'], enviado: ['entregue'],
        }
        if (proximo && proximo !== atual && !transicoes[atual]?.includes(proximo)) {
          throw new ErroHttp(409, 'A confirmação e o cancelamento financeiro exigem conciliação com o provedor. Atualize somente a entrega de pedidos pagos.')
        }
      }
      valores = Array.isArray(valores) ? lista : lista[0]
    }
    const colunas: string = regra.leitura
    const from = user.db.from(tabela as string)
    const inicial = operacao === 'select' ? from.select(colunas) : operacao === 'insert' ? from.insert(valores).select(colunas)
      : operacao === 'update' ? from.update(valores).select(colunas) : from.delete().select('id')
    let query = inicial as unknown as Consulta
    const campos = new Set(regra.leitura.split(',').filter(c => /^[a-z_]+$/.test(c)))
    for (const filtro of filtros) {
      if (!filtro || !campos.has(filtro.campo) || !['eq','gt','in'].includes(filtro.op)) throw new ErroHttp(400, 'Filtro inválido.')
      if (filtro.op === 'in') {
        if (!Array.isArray(filtro.valor) || filtro.valor.length > 30 || filtro.valor.some((v: unknown) => !['string','number','boolean'].includes(typeof v))) throw new ErroHttp(400, 'Lista inválida.')
        query = query.in(filtro.campo, filtro.valor)
      } else {
        if (!['string','number','boolean'].includes(typeof filtro.valor)) throw new ErroHttp(400, 'Valor inválido.')
        query = filtro.op === 'eq' ? query.eq(filtro.campo, filtro.valor) : query.gt(filtro.campo, filtro.valor)
      }
    }
    if (body.ordem) {
      if (!campos.has(body.ordem.campo)) throw new ErroHttp(400, 'Ordenação inválida.')
      query = query.order(body.ordem.campo, { ascending: body.ordem.ascending !== false })
    }
    if (body.limite) {
      if (!Number.isSafeInteger(body.limite) || body.limite < 1 || body.limite > 1000) throw new ErroHttp(400, 'Limite inválido.')
      query = query.limit(body.limite)
    }
    const result = body.single ? await query.maybeSingle() : await query
    if (result.error) throw result.error
    if (operacao !== 'select' && (tabela === 'produtos' || tabela === 'cupons')) {
      revalidateTag('vitrine-publica', { expire: 0 })
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
