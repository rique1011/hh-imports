const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createDb, adapter, loadTs } = require('./helpers.cjs')
const sharp = require('sharp')
process.env.NEXTAUTH_SECRET = 'fixture-exclusiva-fotos-produto'

test('catálogo aceita uma galeria com mais de 12 uploads sem permitir uploads de clientes no catálogo', async t => {
  const db = await createDb('bigint', 'bigint'); t.after(() => db.close())
  const client = adapter(db), enviados = []
  client.storage = { from: bucket => ({
    upload: async (path, bytes, options) => { enviados.push({ bucket, path, bytes, options }); return { error: null } },
    getPublicUrl: path => ({ data: { publicUrl: 'https://fvcbdrvpvbdmmirzffgl.supabase.co/storage/v1/object/public/joias/' + path } }),
  }) }
  let admin = true
  const auth = loadTs('lib/autorizacao')
  const mocks = { '@/lib/supabase-admin': { getSupabaseAdmin: () => client },
    '@/lib/autorizacao': { ...auth, exigirUsuario: async () => ({ id: 1, admin, db: client }) } }
  const route = loadTs('app/api/uploads/route', mocks)
  const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#bda05e' } }).jpeg().toBuffer()
  function request(bytes = image) {
    const form = new FormData(); form.set('arquivo', new File([bytes], 'joia.jpg', { type: 'image/jpeg' })); form.set('tipo', 'produtos')
    return new Request('https://loja.test/api/uploads', { method: 'POST', headers: { origin: 'https://loja.test' }, body: form })
  }
  for (let i = 0; i < 13; i++) assert.equal((await route.POST(request())).status, 200)
  assert.equal(new Set(enviados.map(f => f.path)).size, 13)
  assert.ok(enviados.every(f => f.bucket === 'joias' && f.options.upsert === false && f.options.contentType === 'image/webp'))
  assert.equal((await sharp(enviados[0].bytes).metadata()).format, 'webp')
  admin = false
  assert.equal((await route.POST(request())).status, 403)
  assert.equal(enviados.length, 13)
  admin = true
  assert.equal((await route.POST(request(Buffer.alloc(4 * 1024 * 1024 + 1)))).status, 400)
  assert.equal(enviados.length, 13)
})
