// Public client configuration. The publishable key is safe to ship: every table is protected by
// row level security and all writes go through checked database functions.
export const SUPABASE_URL = 'https://PROJECT_REF.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'PUBLISHABLE_KEY'
// Public half of the Web Push (VAPID) key pair. The private half lives only in Supabase Vault.
export const VAPID_PUBLIC_KEY = 'VAPID_PUBLIC_KEY'
