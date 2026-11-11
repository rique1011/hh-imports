import { categoriaDoProduto, type CategoriaSalva } from '@/lib/categorias'
import type { Produto } from '@/types/loja'

export const normalizarBusca = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export function grupoMaterial(material: string | null | undefined) {
  const m = normalizarBusca(material || '')
  if (/prata\s*925|silver\s*925/.test(m)) return 'Prata 925'
  if (/folhead|banhad/.test(m)) return 'Joias folheadas'
  if (/bijut/.test(m)) return 'Bijuterias'
  return material?.trim() || 'Material não informado'
}
export interface FiltrosCatalogo { busca: string; material: string; categoria: string; precoMin: string; precoMax: string; disponivel: boolean; ordem: string }
export const FILTROS_INICIAIS: FiltrosCatalogo = { busca: '', material: '', categoria: '', precoMin: '', precoMax: '', disponivel: false, ordem: 'recentes' }

export function filtrarCatalogo(produtos: readonly Produto[], filtros: FiltrosCatalogo, categorias: readonly CategoriaSalva[] = []) {
  const busca = normalizarBusca(filtros.busca)
  const min = filtros.precoMin === '' ? 0 : Math.max(0, Number(filtros.precoMin) || 0)
  const max = filtros.precoMax === '' ? Infinity : Math.max(0, Number(filtros.precoMax) || 0)
  const resultado = produtos.filter(p => (!busca || normalizarBusca(p.nome + ' ' + (p.material || '')).includes(busca))
    && (!filtros.material || grupoMaterial(p.material) === filtros.material)
    && (!filtros.categoria || categoriaDoProduto(p, categorias) === filtros.categoria)
    && Number(p.preco) >= min && Number(p.preco) <= max
    && (!filtros.disponivel || Math.max(0, Number(p.estoque || 0) - Number(p.estoque_reservado || 0)) > 0))
  if (filtros.ordem === 'menor-preco') resultado.sort((a, b) => Number(a.preco) - Number(b.preco))
  if (filtros.ordem === 'maior-preco') resultado.sort((a, b) => Number(b.preco) - Number(a.preco))
  if (filtros.ordem === 'nome') resultado.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return resultado
}
