import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.SCIMIT_API ?? 'http://localhost:3000',
        changeOrigin: true,
        xfwd: true,
      },
      // xfwd: the backend builds SAML URLs from X-Forwarded-Host, so they match what the browser sees
      '/saml': {
        target: process.env.SCIMIT_API ?? 'http://localhost:3000',
        changeOrigin: true,
        xfwd: true,
      },
      '/scim': {
        target: process.env.SCIMIT_API ?? 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
