import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // cubejs (CoffeeScript build) references `global` at load time
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['cubejs'],
  },
  build: {
    commonjsOptions: {
      include: [/cubejs/, /node_modules/],
    },
  },
})
