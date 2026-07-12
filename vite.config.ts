import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// itch.io 配信は相対パスzip展開のため base: './' 必須
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  server: {
    allowedHosts: true,
    // dev専用: /api を wrangler dev（auth-worker）へ流す。本番ビルドには影響しない
    proxy: { '/api': 'http://localhost:8787' },
  },
})
