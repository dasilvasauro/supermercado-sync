import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// IMPORTANTE: Mude 'supermercado-sync' para o exato nome do repositório que você vai criar no GitHub
export default defineConfig({
  base: '/supermercado-sync/', 
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Supermercado Sync',
        short_name: 'Supermercado',
        description: 'Lista de compras sincronizada em tempo real',
        theme_color: '#16a34a', // Cor verde do nosso app
        background_color: '#f9fafb',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
