import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, API calls go to the dashboard server (npm start)
const apiTarget = process.env.API_TARGET || 'http://localhost:3000'

export default defineConfig({
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
    }
  },
  plugins: [react()]
})
