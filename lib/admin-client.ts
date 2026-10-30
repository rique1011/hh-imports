'use client'
import type { supabase as SupabasePublico } from '@/lib/supabase'

/** Adaptador restrito às consultas usadas pelo painel. A autorização ocorre na API. */
class ConsultaAdmin {
  private pedido: { tabela: string; operacao: string; filtros: { campo: string; op: string; valor: unknown }[]; valores?: unknown; ordem?: { campo: string; ascending: boolean }; limite?: number; single?: boolean }
  constructor(tabela: string) { this.pedido = { tabela, operacao: 'select', filtros: [] } }
  select() { return this }
  insert(valores: unknown) { this.pedido.operacao = 'insert'; this.pedido.valores = valores; return this }
  update(valores: unknown) { this.pedido.operacao = 'update'; this.pedido.valores = valores; return this }
  delete() { this.pedido.operacao = 'delete'; return this }
  eq(campo: string, valor: unknown) { this.pedido.filtros.push({ campo, op: 'eq', valor }); return this }
  gt(campo: string, valor: unknown) { this.pedido.filtros.push({ campo, op: 'gt', valor }); return this }
  in(campo: string, valor: unknown[]) { this.pedido.filtros.push({ campo, op: 'in', valor }); return this }
  order(campo: string, options: { ascending: boolean }) { this.pedido.ordem = { campo, ascending: options.ascending }; return this }
  limit(limite: number) { this.pedido.limite = limite; return this }
  async executar() {
    try {
      const response = await fetch('/api/admin/dados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.pedido), cache: 'no-store' })
      const json = await response.json()
      return response.ok ? json : { data: null, error: { message: json.error || 'Operação indisponível.' } }
    } catch { return { data: null, error: { message: 'Falha de conexão.' } } }
  }
  single() { this.pedido.single = true; return this.executar() }
  maybeSingle() { return this.single() }
  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) { return this.executar().then(resolve, reject) }
}

// A interface compatível permite migrar o painel sem duplicar suas regras de negócio.
export const supabaseAdmin = { from: (tabela: string) => new ConsultaAdmin(tabela) } as unknown as typeof SupabasePublico
