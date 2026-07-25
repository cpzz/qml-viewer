import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export default defineConfig({
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
