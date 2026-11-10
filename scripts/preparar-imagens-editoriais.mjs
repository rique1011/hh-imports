import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fontes = {
  hero: 'hero-colar.webp',
  colares: 'colecao-colares.webp',
  pulseiras: 'colecao-pulseiras.webp',
  brincos: 'colecao-brincos.webp',
  editorial: 'editorial-dourado.webp',
}
const opcoes = { larguras: [390, 480, 640, 750, 828, 1080, 1200, 1280], avif: 50, webp: 75, versao: 1 }

// Só fotos editoriais fixas. Uploads e banners personalizados continuam no Next Image.
export async function prepararImagensEditoriais() {
  const destino = path.join(raiz, 'public/images/editorial')
  await mkdir(destino, { recursive: true })
  const manifest = {}
  for (const [nome, arquivo] of Object.entries(fontes)) {
    const origem = await readFile(path.join(raiz, 'public/images', arquivo))
    const metadados = await sharp(origem).metadata()
    if (!metadados.width || !metadados.height) throw new Error(`Imagem editorial inválida: ${arquivo}`)
    const hash = createHash('sha256').update(origem).update(JSON.stringify(opcoes)).digest('hex').slice(0, 12)
    const larguras = [...new Set([...opcoes.larguras.filter(w => w < metadados.width), metadados.width])]
    const formatos = { avif: [], webp: [] }
    for (const largura of larguras) {
      for (const formato of ['avif', 'webp']) {
        const nomeArquivo = `${nome}-${hash}-${largura}.${formato}`
        const saida = path.join(destino, nomeArquivo)
        if (!(await stat(saida).catch(() => null))?.size) {
          const foto = sharp(origem).resize({ width: largura, withoutEnlargement: true })
          const temporario = `${saida}.${randomUUID()}.tmp`
          if (formato === 'avif') await foto.avif({ quality: opcoes.avif, effort: 4 }).toFile(temporario)
          else await foto.webp({ quality: opcoes.webp, effort: 4 }).toFile(temporario)
          await rename(temporario, saida)
        }
        formatos[formato].push({ src: `/images/editorial/${nomeArquivo}`, width: largura })
      }
    }
    manifest[nome] = { width: metadados.width, height: metadados.height, ...formatos }
  }
  const arquivoManifest = path.join(raiz, 'lib/imagens-editoriais.json')
  const json = JSON.stringify(manifest, null, 2) + '\n'
  if ((await readFile(arquivoManifest, 'utf8').catch(() => '')) !== json) await writeFile(arquivoManifest, json)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepararImagensEditoriais().catch(erro => { console.error(erro); process.exitCode = 1 })
}
