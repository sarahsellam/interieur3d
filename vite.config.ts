import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' : l'application fonctionne quel que soit le dossier où elle est hébergée.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
