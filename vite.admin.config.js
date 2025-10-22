import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  root: 'admin-src',
  plugins: [
    react(),
    {
      name: 'copy-icon',
      closeBundle() {
        // Copy icon.svg from public to admin-dist after build
        copyFileSync(
          resolve(__dirname, 'public/icon.svg'),
          resolve(__dirname, 'admin-dist/icon.svg')
        )
      }
    }
  ],
  build: {
    outDir: '../admin-dist',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/icon.svg': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
