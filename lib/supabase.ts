import { createClient } from '@supabase/supabase-js'

// Tenta pegar de NEXT_PUBLIC_SUPABASE_URL ou de SUPABASE_URL
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

// Remove aspas e espaços
let supabaseUrl = rawUrl.replace(/["']/g, '').trim()
const supabaseAnonKey = rawKey.replace(/["']/g, '').trim()

// 🔥 O SEGREDO: Se a URL tiver "/rest/v1/?" no final, isso aqui limpa automaticamente!
try {
  if (supabaseUrl.startsWith('http')) {
    const urlObj = new URL(supabaseUrl)
    supabaseUrl = urlObj.origin // Mantém APENAS a base: https://fvcbdrvpvbdmmirzffgl.supabase.co
  }
} catch {
  // Ignora o erro silenciosamente se a URL vier vazia no build
}

// Garante que a URL seja válida para o SDK do Supabase não dar erro de "Invalid path"
const finalUrl = supabaseUrl.startsWith('http') 
  ? supabaseUrl 
  : 'https://placeholder.supabase.co'

export const supabase = createClient(
  finalUrl, 
  supabaseAnonKey || 'placeholder-key'
)
