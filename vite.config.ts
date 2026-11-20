import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' : l'application fonctionne quel que soit le dossier où elle est hébergée.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Application installable : manifeste, icônes et fonctionnement hors connexion.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Mon Intérieur 3D',
        short_name: 'Intérieur 3D',
        description: 'Recréez votre pièce en 3D, essayez des aménagements et gardez celui que vous préférez.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f8f5f0',
        theme_color: '#f8f5f0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout ce qu'il faut pour travailler sans connexion : code, polices, meubles, textures, vignettes.
        // (Les écrans de démarrage ne servent qu'à l'ouverture sur iPhone/iPad : inutile de les stocker.)
        globPatterns: ['**/*.{js,css,html,woff2,png,webp,json}'],
        globIgnores: ['splash/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
