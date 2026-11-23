/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// En GitHub Pages la app vive en /<nombre-del-repo>/. El workflow define BASE_PATH.
const base = process.env.BASE_PATH || '/';

// Content-Security-Policy por meta tag. Solo en producción: en desarrollo Vite
// necesita scripts en línea para la recarga en caliente.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://docs.google.com https://*.googleusercontent.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'gladys-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo-gladys-perez.png'],
      manifest: {
        name: 'Gladys Pérez',
        short_name: 'Gladys Pérez',
        description: 'Gladys Pérez · Asesora inmobiliaria',
        lang: 'es',
        theme_color: '#1f4fa3',
        background_color: '#1f4fa3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Red primero, caché de respaldo, para todo lo que sea del mismo origen.
            urlPattern: ({ sameOrigin }) => sameOrigin,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gladys-app',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/tests/*.test.ts'],
    testTimeout: 30_000,
  },
});
