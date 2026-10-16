import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// cubejs is CoffeeScript output that reads `this.Cube` while the wrapper
// runs as `.call(this)`. Vite's production bundle is strict ESM, so `this`
// is undefined and the app throws on load.
function cubejsGlobalThis(): Plugin {
  return {
    name: 'cubejs-global-this',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/cubejs/lib/')) return
      if (!code.includes('this.Cube') && !code.includes('.call(this)')) return
      return {
        code: code
          .replaceAll('this.Cube', 'globalThis.Cube')
          .replaceAll('.call(this)', '.call(globalThis)'),
        map: null,
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [cubejsGlobalThis(), react()],
  worker: {
    format: 'es',
    plugins: () => [cubejsGlobalThis()],
  },
  optimizeDeps: {
    include: ['cubejs'],
    rolldownOptions: {
      plugins: [cubejsGlobalThis()],
    },
  },
  build: {
    commonjsOptions: {
      include: [/cubejs/, /node_modules/],
    },
  },
})
