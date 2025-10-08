import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'My Mobile App',
        short_name: 'MobileApp',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#42b883',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),

    // ✅ Compress JS/CSS/HTML in production builds
    compression({
      algorithm: 'brotliCompress', // smaller than gzip
      threshold: 10240, // only compress files >10kb
    }),

  ],
  server: {
    proxy: {
      // Proxy any request starting with /api to Flask backend
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  // ✅ Speed up rebuilds during development
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },

  // ✅ Optimize production output
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild', // faster than terser
  },

})
