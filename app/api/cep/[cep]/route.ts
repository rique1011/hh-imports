import { NextResponse } from 'next/server'
import { ESTADOS } from '@/lib/enderecos'

export async function GET(_request: Request, { params }: { params: Promise<{ cep: string }> }) {
  const { cep } = await params
  if (!/^\d{8}$/.test(cep)) return NextResponse.json({ error: 'Informe um CEP com oito dígitos.' }, { status: 400 })
  let naoEncontrados = 0
  const fontes = [`https://brasilapi.com.br/api/cep/v1/${cep}`, `https://viacep.com.br/ws/${cep}/json/`]
  for (const fonte of fontes) {
    try {
      const res = await fetch(fonte, { signal: AbortSignal.timeout(4000), redirect: 'error', next: { revalidate: 86400 } })
      if (res.status === 404) { naoEncontrados++; continue }
      if (!res.ok) continue
      const dados = await res.json()
      if (dados?.erro === true || dados?.erro === 'true') { naoEncontrados++; continue }
      const texto = (valor: unknown, max: number) => typeof valor === 'string' ? valor.trim().slice(0, max) : ''
      const endereco = { cep, logradouro: texto(dados.street ?? dados.logradouro, 200), bairro: texto(dados.neighborhood ?? dados.bairro, 120),
        cidade: texto(dados.city ?? dados.localidade, 120), uf: texto(dados.state ?? dados.uf, 2).toUpperCase() }
      if (!endereco.cidade || !ESTADOS.includes(endereco.uf)) continue
      return NextResponse.json(endereco, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } })
    } catch { /* A segunda fonte mantém a consulta disponível se a primeira falhar. */ }
  }
  return NextResponse.json({ error: naoEncontrados === fontes.length
    ? 'CEP não encontrado. Confira os oito dígitos ou preencha o endereço manualmente.'
    : 'A consulta de CEP está indisponível. Você pode preencher o endereço manualmente.' },
  { status: naoEncontrados === fontes.length ? 404 : 503, headers: { 'Cache-Control': 'no-store' } })
}
