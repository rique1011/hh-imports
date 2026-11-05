const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

exports.loadTs = function loadTs(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, file.endsWith('.ts') ? file : file + '.ts')
  if (cache.has(filename)) return cache.get(filename).exports
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  cache.set(filename, mod)
  mod.require = id => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id]
    if (id === 'server-only') return {}
    if (id.startsWith('@/')) return loadTs(id.slice(2), mocks, cache)
    return require(require.resolve(id, { paths: [root] }))
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename)
  return mod.exports
}

exports.createDb = async function createDb(idType = 'uuid') {
  const { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite()
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;")
  await db.exec(
    'CREATE TABLE usuarios(id uuid primary key default gen_random_uuid(),email text unique,nome text,perfil text,role text,' +
    'cpf_cnpj text default \'12345678901\',whatsapp text default \'11999999999\',endereco text default \'{\"cep\":\"01310100\",\"logradouro\":\"Rua Teste\",\"numero\":\"10\",\"bairro\":\"Centro\",\"cidade\":\"Sao Paulo\",\"uf\":\"SP\"}\',saldo_cashback numeric default 0,created_at timestamptz default now());' +
    'CREATE TABLE produtos(id uuid primary key,nome text,preco numeric,estoque integer default 1000,estoque_reservado integer default 0,fotos text[],slug text);' +
    'CREATE TABLE cupons(codigo text primary key,desconto numeric,ativo boolean default true,usuario_id uuid);' +
    'CREATE TABLE pedidos(id ' + (idType === 'uuid' ? 'uuid primary key default gen_random_uuid()' : 'bigint generated always as identity primary key') +
    ',cliente_email text,cliente_nome text,status text,total numeric,itens jsonb,codigo_rastreio text,created_at timestamptz default now());'
  )
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261013040238_hh_notifications.sql'), 'utf8'))
  const estoque = fs.readdirSync(path.join(root, 'supabase/migrations')).find(name => name.endsWith('_estoque_transacional.sql'))
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', estoque), 'utf8'))
  const envio = fs.readdirSync(path.join(root, 'supabase/migrations')).find(name => name.endsWith('_melhor_envio_etiquetas.sql'))
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', envio), 'utf8'))
  const automatico = fs.readdirSync(path.join(root, 'supabase/migrations')).find(name => name.endsWith('_envio_automatico.sql'))
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', automatico), 'utf8'))
  return db
}

exports.adapter = function adapter(db) {
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.params = []; this.columns = '*'; this.head = false }
    select(columns = '*', options = {}) { this.columns = columns; this.head = !!options.head; return this }
    update(values) { this.values = values; return this }
    limit(value) { this.maxRows = Number(value); return this }
    eq(key, value) { this.params.push(value); this.filters.push('"' + key + '"=$' + this.params.length); return this }
    is(key, value) { if (value !== null) throw new Error("Fixture supports only IS NULL"); this.filters.push('"' + key + '" IS NULL'); return this }
    in(key, values) {
      const markers = values.map(value => { this.params.push(value); return '$' + this.params.length })
      this.filters.push('"' + key + '" IN (' + markers.join(',') + ')'); return this
    }
    async execute(single = false) {
      try {
        const where = this.filters.length ? ' WHERE ' + this.filters.join(' AND ') : ''
        let query
        const params = this.params.slice()
        if (this.values) {
          const updates = Object.entries(this.values).map(([key, value]) => {
            params.push(value); return '"' + key + '"=$' + params.length
          })
          query = 'UPDATE "' + this.table + '" SET ' + updates.join(',') + where + ' RETURNING ' + this.columns
        } else {
          query = 'SELECT ' + (this.head ? 'count(*)::integer AS count' : this.columns) + ' FROM "' + this.table + '"' + where +
            (this.maxRows ? ' LIMIT ' + this.maxRows : '')
        }
        const result = await db.query(query, params)
        if (this.head) return { data: null, count: result.rows[0].count, error: null }
        return { data: single ? result.rows[0] || null : result.rows, error: null }
      } catch (error) { return { data: null, error: { message: error.message } } }
    }
    single() { return this.execute(true) }
    maybeSingle() { return this.execute(true) }
    then(resolve, reject) { return this.execute().then(resolve, reject) }
  }
  return {
    from: table => new Query(table),
    async rpc(name, args) {
      try {
        const entries = Object.entries(args)
        const query = 'SELECT * FROM public."' + name + '"(' +
          entries.map(([key], index) => '"' + key + '" => $' + (index + 1)).join(',') + ')'
        const result = await db.query(query, entries.map(([, value]) =>
          typeof value === 'object' && value !== null ? JSON.stringify(value) : value))
        const json = result.rows[0]?.[name]
        return { data: Object.prototype.hasOwnProperty.call(result.rows[0] || {}, name) ? json : result.rows, error: null }
      } catch (error) { return { data: null, error: { message: error.message } } }
    },
  }
}

