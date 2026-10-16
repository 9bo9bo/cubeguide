import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// cubejs は CoffeeScript の出力で、`.call(this)` で実行されるラッパーの中で
// `this.Cube` を参照する。Vite の本番バンドルは strict な ESM なので `this` が
// undefined になり、読み込み時にエラーになる。
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
