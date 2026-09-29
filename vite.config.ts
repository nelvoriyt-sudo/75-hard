import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { SUPABASE_URL } from './src/config.ts'

// Content Security Policy for the production build only (Vite's dev server needs inline scripts
// and a websocket). GitHub Pages can't send headers, so it goes in a meta tag.
function csp(supabaseUrl: string): Plugin {
  const supabase = new URL(supabaseUrl)
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${supabase.origin} wss://${supabase.host}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<!-- CSP -->', `<meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

export default defineConfig({
  base: '/75-hard/',
  plugins: [preact(), csp(SUPABASE_URL)],
  build: { target: 'es2022', sourcemap: false },
})
