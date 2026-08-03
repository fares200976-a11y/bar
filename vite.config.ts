import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Précache l'app shell (JS/CSS/HTML générés par le build) — c'est ce
        // qui permet à l'app de s'ouvrir même sans connexion Internet.
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Les données en temps réel (Supabase) ne sont JAMAIS mises en
          // cache ici — seul le code de l'app l'est. Le menu/tables restent
          // gérés par le cache localStorage déjà en place côté store.ts.
          navigateFallback: '/index.html',
        },
        manifest: {
          name: 'Bar — Caisse & Commandes',
          short_name: 'Bar',
          description: 'Application de caisse, commandes et gestion pour bar/restaurant',
          theme_color: '#5A5A40',
          background_color: '#5A5A40',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
