import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// Security headers, including the Content Security Policy, are set in vercel.json.
export default defineConfig({
  plugins: [preact()],
  build: { target: 'es2022', sourcemap: false },
})
