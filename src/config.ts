// Public client configuration. The publishable key is safe to ship: every table is protected by
// row level security and all writes go through checked database functions.
export const SUPABASE_URL = 'https://okricghotvosmxygkovr.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_f8G2vFJgIi_I1xjHFndV6A_JWGOAt01'
// Public half of the Web Push (VAPID) key pair. The private half lives only in Supabase Vault.
export const VAPID_PUBLIC_KEY = 'BEXhAYiZ664ZtpvN_Zsm1oXOunAT1stTnqUZxnDVAm4JXWah2VZxYLVIGIqnqgFmYyvKZrkL_ypkJMRXdHvLHvo'
