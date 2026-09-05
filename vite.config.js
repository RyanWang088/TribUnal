import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forwarded to server/index.js so the Anthropic API key stays
      // server-side and never ships in the browser bundle.
      '/api': 'http://localhost:8787',
    },
  },
})
