import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA wiring is added now so the install/offline shell works from the start.
// Public showcase pages are cached for offline; the /admin area is explicitly
// kept OUT of the offline shell (navigateFallbackDenylist) so auth state and
// writes always go to the network.
// Final app icons live in /public/icons (see public/icons note).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'ci-tech-logo.png'],
      workbox: {
        // Never serve the cached app shell for admin/auth routes.
        navigateFallbackDenylist: [/^\/admin/, /^\/\.netlify\/functions/, /^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Drop any precache entries left over from a previous SW version so
        // users don't get stuck on old bundles after a deploy.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      manifest: {
        name: 'CI-Tech — Project Showcase',
        short_name: 'CI-Tech',
        description:
          'A trilingual showcase of tech projects — education, cultural, community and tool apps — with an admin panel to manage them.',
        theme_color: '#0f1732',
        background_color: '#f4f7fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
