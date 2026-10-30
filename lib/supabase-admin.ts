import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

export function getSupabaseAdmin() {
  if (client) return client
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  client = createClient(new URL(url.replace(/["']/g, '').trim()).origin, key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
