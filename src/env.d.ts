/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    openFile: () => Promise<{ filePath: string; content: string } | null>
    saveFile: (filePath: string, content: string) => Promise<boolean>
    refreshPreview: (content: string) => Promise<{ success: boolean; error?: string }>
  }
}
