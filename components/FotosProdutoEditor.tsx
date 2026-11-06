'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react'
import { MAX_BYTES_FOTO_PRODUTO, MAX_FOTOS_PRODUTO, TIPOS_FOTO_PRODUTO, type FotoProdutoEdicao } from '@/lib/fotos-produto'

interface Props {
  fotos: FotoProdutoEdicao[]
  onChange: (fotos: FotoProdutoEdicao[]) => void
  desabilitado: boolean
}

export default function FotosProdutoEditor({ fotos, onChange, desabilitado }: Props) {
  const previews = useRef(new Set<string>())
  const [erro, setErro] = useState('')

  useEffect(() => {
    const urls = previews.current
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear() }
  }, [])
  useEffect(() => {
    for (const url of previews.current) {
      if (!fotos.some(foto => foto.url === url)) {
        URL.revokeObjectURL(url)
        previews.current.delete(url)
      }
    }
  }, [fotos])

  function adicionar(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(event.target.files || [])
    event.target.value = ''
    const novas: FotoProdutoEdicao[] = [], erros: string[] = []
    for (const arquivo of arquivos) {
      if (!TIPOS_FOTO_PRODUTO.includes(arquivo.type) || arquivo.size < 1 || arquivo.size > MAX_BYTES_FOTO_PRODUTO) {
        erros.push(`${arquivo.name}: use JPEG, PNG ou WebP de até 4 MB.`)
        continue
      }
      if (fotos.length + novas.length >= MAX_FOTOS_PRODUTO) {
        erros.push(`Você pode usar até ${MAX_FOTOS_PRODUTO} fotos por produto.`)
        break
      }
      if ([...fotos, ...novas].some(foto => foto.arquivo?.name === arquivo.name && foto.arquivo.size === arquivo.size && foto.arquivo.lastModified === arquivo.lastModified)) continue
      const url = URL.createObjectURL(arquivo)
      previews.current.add(url)
      novas.push({ id: crypto.randomUUID(), url, arquivo })
    }
    setErro(erros.join(' '))
    if (novas.length) onChange([...fotos, ...novas])
  }

  function mover(indice: number, destino: number) {
    const lista = [...fotos]
    const [foto] = lista.splice(indice, 1)
    lista.splice(destino, 0, foto)
    onChange(lista)
  }

  const botao = 'grid min-h-11 min-w-11 place-items-center rounded border border-gray-700 text-gray-300 transition hover:border-hb-gold hover:text-hb-gold disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hb-gold'
  return <section aria-labelledby="titulo-fotos-produto" className="min-w-0 rounded-xl border border-gray-800 bg-hb-black p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 id="titulo-fotos-produto" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-300"><ImagePlus size={16} className="text-hb-gold" />Fotos do produto</h3>
      <span className="text-xs text-gray-400">{fotos.length}/{MAX_FOTOS_PRODUTO} fotos</span>
    </div>
    <p id="ajuda-fotos-produto" className="mb-4 text-xs leading-6 text-gray-400">Selecione várias fotos de uma vez ou adicione aos poucos. A primeira é a capa da loja. JPEG, PNG ou WebP, até 4 MB por foto.</p>
    <label htmlFor="fotos-produto" className="mb-2 block text-xs font-medium text-hb-gold">Adicionar fotos</label>
    <input id="fotos-produto" type="file" multiple accept={TIPOS_FOTO_PRODUTO.join(',')} disabled={desabilitado || fotos.length >= MAX_FOTOS_PRODUTO}
      aria-describedby="ajuda-fotos-produto" onChange={adicionar}
      className="block min-h-11 w-full min-w-0 text-xs text-gray-400 file:mr-3 file:min-h-11 file:rounded file:border-0 file:bg-gray-800 file:px-4 file:text-xs file:font-semibold file:text-gray-100 disabled:opacity-50" />
    {erro && <p role="alert" className="mt-3 break-words text-xs leading-6 text-red-300">{erro}</p>}
    {fotos.length > 0 ? <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Fotos na ordem de exibição">
      {fotos.map((foto, index) => <li key={foto.id} className="min-w-0 overflow-hidden rounded-lg border border-gray-800">
        <div className="relative aspect-[4/5] bg-luxury-surface">
          <Image src={foto.url} alt={`Prévia da foto ${index + 1}`} fill sizes="(max-width: 639px) 40vw, 180px" unoptimized={foto.url.startsWith('blob:')} className="object-cover" />
          {index === 0 && <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/85 px-2 py-1 text-[10px] text-hb-gold"><Star size={11} />Capa</span>}
          <button type="button" aria-label={`Remover foto ${index + 1}`} disabled={desabilitado} onClick={() => onChange(fotos.filter(item => item.id !== foto.id))}
            className="absolute right-1 top-1 grid min-h-11 min-w-11 place-items-center rounded-full bg-black/80 text-white transition hover:text-red-300 disabled:opacity-40"><Trash2 size={17} /></button>
        </div>
        <div className="space-y-2 p-2">
          <p className="text-xs text-gray-400">Foto {index + 1}{foto.arquivo ? ' · nova' : ''}</p>
          <div className="-mx-1 flex justify-between">
            <button type="button" aria-label={`Mover foto ${index + 1} para antes`} disabled={desabilitado || index === 0} onClick={() => mover(index, index - 1)} className={botao}><ArrowLeft size={16} /></button>
            <button type="button" aria-label={`Mover foto ${index + 1} para depois`} disabled={desabilitado || index === fotos.length - 1} onClick={() => mover(index, index + 1)} className={botao}><ArrowRight size={16} /></button>
          </div>
          <button type="button" aria-label={`Usar foto ${index + 1} como capa`} disabled={desabilitado || index === 0} onClick={() => mover(index, 0)}
            className="min-h-11 w-full rounded border border-hb-gold/40 px-1 text-[10px] font-medium text-hb-gold transition hover:bg-hb-gold/10 disabled:opacity-40">{index === 0 ? 'Foto de capa' : 'Usar como capa'}</button>
        </div>
      </li>)}
    </ol> : <p className="mt-4 text-xs text-gray-500">Adicione a capa e mostre detalhes, fecho e diferentes ângulos da peça.</p>}
    <p className="mt-4 text-xs text-gray-500">As alterações nas fotos são publicadas ao salvar o produto.</p>
  </section>
}
