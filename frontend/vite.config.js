import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  publicDir: 'public',
  plugins: [
    react(),

    compression({
      algorithm: 'brotliCompress',
      threshold: 10240,
    }),

  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom'],
  },

  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    minify: 'esbuild',
  },

})
