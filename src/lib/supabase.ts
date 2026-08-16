import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env (veja .env.example).',
  )
}

// Instância self-hosted, schema dedicado (não `public`) — ver
// supabase/migrations/0001_init_schema.sql. O PostgREST do stack precisa
// expor `nf_forneria` (env PGRST_DB_SCHEMAS) para essas queries funcionarem.
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  db: { schema: 'nf_forneria' },
})
