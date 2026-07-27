import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor/esm/vs/')) {
            if (id.includes('/vs/editor/standalone/')) return 'monaco-editor-standalone'
            if (id.includes('/vs/editor/contrib/')) return 'monaco-editor-contrib'
            if (id.includes('/vs/editor/browser/')) {
              const browserMatch = id.match(/\/vs\/editor\/browser\/([^/]+)/)
              const browserGroup = browserMatch?.[1]
              if (browserGroup === 'widget') return 'monaco-editor-browser-widget'
              if (browserGroup === 'viewParts') return 'monaco-editor-browser-viewparts'
              if (browserGroup === 'controller') return 'monaco-editor-browser-controller'
              if (browserGroup === 'services') return 'monaco-editor-browser-services'
              if (browserGroup === 'config') return 'monaco-editor-browser-config'
              if (browserGroup === 'core') return 'monaco-editor-browser-core'
              return 'monaco-editor-browser-misc'
            }
            if (id.includes('/vs/editor/common/')) return 'monaco-editor-common'
            if (id.includes('/vs/base/')) return 'monaco-base'
            if (id.includes('/vs/language/')) return 'monaco-language'
            if (id.includes('/vs/platform/')) return 'monaco-platform'
            return 'monaco-misc'
          }
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
              },
            },
          },
        },
        onstart(options) {
          ensureDir('dist-electron')
          copyFileSync('electron/preload.cjs', 'dist-electron/preload.cjs')
          options.startup()
        },
      },
    ]),
    renderer(),
  ],
})
