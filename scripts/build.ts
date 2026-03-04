import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { build, type InlineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { rmSync, mkdirSync, cpSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const srcDir = resolve(root, 'src')
const distDir = resolve(root, 'dist')
const outDir = resolve(distDir, 'js')

const isDev = process.env.NODE_ENV === 'development'

const resolveConfig = {
  alias: {
    components: resolve(srcDir, 'components'),
    types: resolve(srcDir, 'types'),
    utils: resolve(srcDir, 'utils'),
  },
  extensions: ['.ts', '.tsx', '.js'],
}

interface EntryConfig {
  name: string
  entry: string
  plugins?: PluginOption[]
}

const entries: EntryConfig[] = [
  { name: 'background', entry: resolve(srcDir, 'background.ts') },
  { name: 'content_script', entry: resolve(srcDir, 'content_script.ts') },
  {
    name: 'sidepanel',
    entry: resolve(srcDir, 'sidepanel.tsx'),
    plugins: [react(), cssInjectedByJsPlugin()],
  },
  { name: 'wa-js', entry: resolve(srcDir, 'wa-js.ts') },
]

async function buildEntry({ name, entry, plugins = [] }: EntryConfig) {
  const config: InlineConfig = {
    configFile: false,
    root,
    publicDir: false,
    resolve: resolveConfig,
    plugins,
    build: {
      outDir,
      emptyOutDir: false,
      lib: {
        entry,
        name: name.replace(/-/g, '_'),
        fileName: () => `${name}.js`,
        formats: ['iife'],
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      minify: isDev ? false : 'esbuild',
      sourcemap: false,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
    logLevel: 'warn',
  }

  console.log(`  Building ${name}...`)
  await build(config)
}

async function main() {
  const start = Date.now()
  console.log(`\n🔨 Building extension (${isDev ? 'dev' : 'prod'})...\n`)

  // Clean dist and create js output dir
  rmSync(distDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  // Copy public assets to dist root
  cpSync(resolve(root, 'public'), distDir, { recursive: true })

  // Build all entries sequentially (IIFE format requires single entry per build)
  for (const entry of entries) {
    await buildEntry(entry)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ Done in ${elapsed}s\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
