'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Palette, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { APARENCIA_PADRAO, type AparenciaLoja } from '@/lib/aparencia'
import { uploadImagem } from '@/lib/upload-imagem'
import BannerCampanha from '@/components/BannerCampanha'
import MarcaLoja from '@/components/MarcaLoja'

const input = 'mt-2 min-h-11 w-full rounded border border-luxury-line bg-luxury-black px-3 py-3 text-base text-luxury-ivory focus:border-luxury-gold outline-none'
type CampoImagem = 'logoUrl' | 'bannerDesktop' | 'bannerMobile'

async function buscarAparencia(signal?: AbortSignal): Promise<{ config: AparenciaLoja; versao: number }> {
  const r = await fetch('/api/admin/aparencia', { cache: 'no-store', signal }), d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Não foi possível carregar a aparência.')
  return d
}

export default function AparenciaAdmin() {
  const router = useRouter()
  const [config, setConfig] = useState<AparenciaLoja>(APARENCIA_PADRAO)
  const [versao, setVersao] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState<CampoImagem | ''>('')
  const [erro, setErro] = useState('')
  const [conflito, setConflito] = useState(false)
  const aplicar = useCallback((d: { config: AparenciaLoja; versao: number }) => {
    setConfig(d.config); setVersao(d.versao); setConflito(false); setErro('')
  }, [])
  async function carregar() {
    setCarregando(true); setErro('')
    try { aplicar(await buscarAparencia()) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha de conexão.') }
    finally { setCarregando(false) }
  }
  useEffect(() => {
    const controller = new AbortController()
    buscarAparencia(controller.signal).then(aplicar).catch(e => {
      if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : 'Falha de conexão.')
    }).finally(() => { if (!controller.signal.aborted) setCarregando(false) })
    return () => controller.abort()
  }, [aplicar])
  function mudar<K extends keyof AparenciaLoja>(campo: K, valor: AparenciaLoja[K]) { setConfig(c => ({ ...c, [campo]: valor })) }
  async function enviar(campo: CampoImagem, arquivo?: File) {
    if (!arquivo) return
    if (arquivo.size > 4 * 1024 * 1024 || !['image/jpeg','image/png','image/webp'].includes(arquivo.type)) { toast.error('Envie JPEG, PNG ou WebP de até 4 MB.'); return }
    setEnviando(campo)
    try { mudar(campo, await uploadImagem(arquivo, 'aparencia')); toast.success('Imagem enviada. Salve as alterações para publicar.') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível enviar a imagem.') }
    finally { setEnviando('') }
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro('')
    try {
      const r = await fetch('/api/admin/aparencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, versao }) }), d = await r.json()
      if (r.status === 409) setConflito(true)
      if (!r.ok) throw new Error(d.error || 'Não foi possível salvar.')
      setConfig(d.config); setVersao(d.versao); toast.success('Aparência publicada na loja.'); router.refresh()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao salvar.'); toast.error('Confira o aviso antes de salvar novamente.') }
    finally { setSalvando(false) }
  }
  if (carregando) return <p role="status" className="flex items-center gap-3 text-luxury-muted"><Loader2 size={18} className="animate-spin" /> Carregando aparência…</p>
  const bloqueado = salvando || !!enviando
  return <main className="mx-auto max-w-5xl min-w-0 pb-8">
    <p className="eyebrow mb-3 flex items-center gap-2"><Palette size={16} /> Sua vitrine, do seu jeito</p>
    <h1 className="font-serif text-3xl text-luxury-ivory sm:text-4xl">Aparência da loja</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-luxury-muted">Troque a logo e a campanha da página inicial. As imagens são otimizadas no envio. Só as alterações salvas aparecem para os clientes.</p>
    {erro && <div role="alert" className="my-6 rounded border border-red-800 bg-red-950/30 p-4 text-sm text-red-200"><p>{erro}</p><button type="button" onClick={() => void carregar()} className="mt-3 min-h-11 underline">Recarregar configuração salva</button></div>}
    {versao > 0 && <form onSubmit={salvar} className="mt-8 space-y-8">
      <fieldset disabled={bloqueado} className="min-w-0 space-y-8 disabled:opacity-70">
        <section className="rounded-xl border border-luxury-line bg-luxury-surface p-5 sm:p-7">
          <h2 className="font-serif text-2xl text-luxury-gold-light">Identidade H&H</h2>
          <p className="mt-2 text-sm leading-6 text-luxury-muted">A logo aparece no cabeçalho e no rodapé. Prefira PNG ou WebP com fundo transparente, em torno de 600 × 240 px.</p>
          <div className="my-5 flex min-h-24 items-center justify-center rounded border border-luxury-line bg-luxury-black p-5 text-center"><MarcaLoja url={config.logoUrl} /></div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-luxury-gold/50 px-4 py-3 text-sm text-luxury-gold-light"><Upload size={16} /> Trocar logo<input aria-label="Enviar logo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => { void enviar('logoUrl', e.target.files?.[0]); e.target.value = '' }} /></label>
          {config.logoUrl && <button type="button" className="ml-4 min-h-11 text-sm text-luxury-muted underline" onClick={() => mudar('logoUrl', '')}>Usar logo original</button>}
        </section>
        <section className="min-w-0 rounded-xl border border-luxury-line bg-luxury-surface p-5 sm:p-7">
          <h2 className="font-serif text-2xl text-luxury-gold-light">Banner da página inicial</h2>
          <label className="my-5 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={config.bannerAtivo} onChange={e => mudar('bannerAtivo', e.target.checked)} className="h-5 w-5 accent-hb-gold" /> Exibir banner na loja</label>
          <label htmlFor="formato-banner" className="block text-sm">Formato</label>
          <select id="formato-banner" className={input} value={config.bannerModo} onChange={e => mudar('bannerModo', e.target.value as AparenciaLoja['bannerModo'])}><option value="editorial">Imagem com textos e botão da loja</option><option value="imagem">Arte pronta, com os textos na própria imagem</option></select>
          <p className="mt-3 text-xs leading-6 text-luxury-muted">Desktop: 1920 × 480 px. Celular: 750 × 800 px, opcional. Em “Arte pronta”, o banner inteiro abre o link escolhido e preserva a imagem sem cortar os textos.</p>
          <div className="my-5 grid min-w-0 gap-5 sm:grid-cols-2">
            {(['bannerDesktop','bannerMobile'] as const).map(campo => <div key={campo} className="min-w-0 rounded border border-luxury-line p-4">
              <h3 className="mb-3 text-sm">{campo === 'bannerDesktop' ? 'Imagem para computador' : 'Imagem para celular (opcional)'}</h3>
              {config[campo] ? <div className="relative mb-3 aspect-[2/1] bg-luxury-black"><Image src={config[campo]} alt="Prévia da imagem do banner" fill sizes="(max-width: 639px) 85vw, 400px" className="object-contain" /></div> : <p className="mb-3 text-xs text-luxury-muted">Usa a imagem do computador.</p>}
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-luxury-gold-light"><Upload size={16} /> {campo === 'bannerDesktop' ? 'Trocar imagem desktop' : 'Trocar imagem mobile'}<input aria-label={campo === 'bannerDesktop' ? 'Enviar banner desktop' : 'Enviar banner mobile'} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => { void enviar(campo, e.target.files?.[0]); e.target.value = '' }} /></label>
              {campo === 'bannerMobile' && config.bannerMobile && <button type="button" className="block min-h-11 text-xs text-luxury-muted underline" onClick={() => mudar('bannerMobile', '')}>Remover versão mobile</button>}
            </div>)}
          </div>
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">Descrição acessível da imagem<input required maxLength={180} className={input} value={config.bannerAlt} onChange={e => mudar('bannerAlt', e.target.value)} /></label>
            {config.bannerModo === 'editorial' && <>
              <label className="block text-sm sm:col-span-2">Chamada acima do título<input maxLength={90} className={input} value={config.chamada} onChange={e => mudar('chamada', e.target.value)} /></label>
              <label className="block text-sm sm:col-span-2">Título<input required maxLength={100} className={input} value={config.titulo} onChange={e => mudar('titulo', e.target.value)} /></label>
              <label className="block text-sm sm:col-span-2">Texto de apoio<input maxLength={200} className={input} value={config.subtitulo} onChange={e => mudar('subtitulo', e.target.value)} /></label>
            </>}
            <label className="block text-sm">{config.bannerModo === 'imagem' ? 'Nome acessível do link' : 'Texto do botão'}<input required maxLength={45} className={input} value={config.botaoTexto} onChange={e => mudar('botaoTexto', e.target.value)} /></label>
            <label className="block text-sm">Link interno<input required maxLength={500} className={input} value={config.botaoLink} onChange={e => mudar('botaoLink', e.target.value)} placeholder="/produtos" /></label>
          </div>
          <p className="mt-5 text-xs leading-6 text-luxury-muted">JPEG, PNG ou WebP de até 4 MB por imagem. Um banner pode divulgar a promoção que você definir; a regra de frete grátis da loja continua sendo R$ 100 em produtos.</p>
        </section>
      </fieldset>
      {enviando && <p role="status" className="flex items-center gap-2 text-sm text-luxury-gold-light"><Loader2 size={16} className="animate-spin" /> Enviando e otimizando imagem…</p>}
      <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={bloqueado || conflito} className="luxury-button gap-3">{salvando && <Loader2 size={16} className="animate-spin" />} Salvar e publicar aparência</button><Link href="/" className="luxury-link">Ver loja</Link></div>
      <section aria-label="Prévia do banner" className="overflow-hidden rounded-xl border border-luxury-line"><p className="bg-luxury-surface px-5 py-3 text-xs text-luxury-muted">Prévia · Reduza a janela para conferir no celular.</p>{config.bannerAtivo ? <BannerCampanha config={config} prioritario={false} /> : <p className="p-8 text-sm text-luxury-muted">O banner está desativado.</p>}</section>
    </form>}
    <aside className="mt-8 rounded-xl border border-luxury-gold/25 p-5 text-sm leading-7 text-luxury-muted"><p>Marque Masculino e Presentes em <Link href="/admin/estoque" className="text-luxury-gold-light underline">Estoque → Editar joia</Link>. Lançamentos reúne as peças dos últimos 30 dias e as marcadas manualmente.</p><p className="mt-2">O frete grátis mantém a cotação real e os dados do destinatário. A automação compra a etiqueta após o pagamento aprovado, respeitando saldo, documento fiscal e limite configurados em <Link href="/admin/pedidos" className="text-luxury-gold-light underline">Pedidos → Etiquetas automáticas</Link>.</p></aside>
  </main>
}
