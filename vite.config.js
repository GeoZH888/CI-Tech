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
        // Never serve the cached app shell for admin/auth routes or any API.
        navigateFallbackDenylist: [/^\/admin/, /^\/\.netlify\/functions/, /^\/api\//, /^\/sb\//],
        // Precache only the *small* app shell — JS, CSS, HTML, favicon, fonts.
        // Large images (logos, mascots, generated variants) go through the
        // runtime image cache below instead, so the precache never balloons
        // and the browser's storage usage doesn't climb on every visit.
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        // Defensive: skip any single file larger than 2 MB from precache
        // (covers the JS bundle but excludes oversized images).
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // Evict old precache entries when a new SW takes over (no orphans).
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Runtime caching: images load from network the first time you see
        // them, are cached for 30 days, and the cache is capped at 30 entries
        // so it can't grow without bound.
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|webp|gif|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ct-images',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
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
