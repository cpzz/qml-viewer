import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  newFile: () => ipcRenderer.invoke('file:new'),
  openFile: () => ipcRenderer.invoke('file:open'),
  openFiles: () => ipcRenderer.invoke('file:openFiles'),
  openDirectory: () => ipcRenderer.invoke('file:openDirectory'),
  saveFile: (content: string, filePath?: string | null) => ipcRenderer.invoke('file:save', content, filePath),
  readFileByPath: (filePath: string) => ipcRenderer.invoke('file:readByPath', filePath),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('file:readDirectory', dirPath),
  statBatch: (paths: string[]) => ipcRenderer.invoke('file:statBatch', paths),
  qmlReadText: (filePath: string) => ipcRenderer.invoke('qml:readText', filePath),
  qmlWriteText: (filePath: string, content: string) => ipcRenderer.invoke('qml:writeText', filePath, content),
  qmlFetchText: (url: string) => ipcRenderer.invoke('qml:fetchText', url),
  qmlClipboardRead: () => ipcRenderer.invoke('qml:clipboardRead'),
  qmlClipboardWrite: (text: string) => ipcRenderer.invoke('qml:clipboardWrite', text),
  onFilesDropped: (callback: (paths: string[]) => void) => {
    ipcRenderer.on('files-dropped', (_event, paths: string[]) => callback(paths))
  },
})
