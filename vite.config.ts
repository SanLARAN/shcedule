import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' — ассеты подключаются относительными путями, поэтому сборка
// одинаково работает и на https://user.github.io/repo/, и на своём домене.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // Разрешаем любые хосты: так предпросмотр работает и в песочнице,
    // и через туннели (ngrok, cloudflared и т.п.).
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
