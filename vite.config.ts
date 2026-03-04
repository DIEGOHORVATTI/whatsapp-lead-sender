import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(__dirname, 'src')

export default defineConfig({
  resolve: {
    alias: {
      components: resolve(srcDir, 'components'),
      types: resolve(srcDir, 'types'),
      utils: resolve(srcDir, 'utils'),
    },
  },
})
