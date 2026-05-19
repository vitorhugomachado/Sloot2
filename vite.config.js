import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Dev/preview: acesso pelo celular na mesma rede + API via proxy (sem localhost no browser). */
const lanAndProxy = {
  host: true,
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
    },
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: lanAndProxy,
  preview: lanAndProxy,
})
