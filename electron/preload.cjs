const { contextBridge, ipcRenderer, webUtils } = require('electron')

// 在 preload 中拦截拖拽事件，用 webUtils.getPathForFile 获取文件路径（Electron v43+ 不支持 File.path）
const handlePreloadDragOver = (e) => {
  e.preventDefault()
}

const handlePreloadDrop = (e) => {
  const paths = []
  if (e.dataTransfer?.files) {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      try {
        const p = webUtils.getPathForFile(e.dataTransfer.files[i])
        if (p) paths.push(p)
      } catch (err) {
        console.error('[preload] webUtils.getPathForFile error:', err)
      }
    }
  }
  if (paths.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    ipcRenderer.send('files-dropped', paths)
  }
}

window.addEventListener('dragover', handlePreloadDragOver, true)
window.addEventListener('drop', handlePreloadDrop, true)

contextBridge.exposeInMainWorld('electronAPI', {
  newFile: () => ipcRenderer.invoke('file:new'),
  openFile: () => ipcRenderer.invoke('file:open'),
  openFiles: () => ipcRenderer.invoke('file:openFiles'),
  openDirectory: () => ipcRenderer.invoke('file:openDirectory'),
  saveFile: (content, filePath) => ipcRenderer.invoke('file:save', content, filePath),
  readFileByPath: (filePath) => ipcRenderer.invoke('file:readByPath', filePath),
  readDirectory: (dirPath) => ipcRenderer.invoke('file:readDirectory', dirPath),
  statBatch: (paths) => ipcRenderer.invoke('file:statBatch', paths),
  onFilesDropped: (callback) => {
    ipcRenderer.on('files-dropped', (_event, paths) => {
      console.log('[preload] files-dropped received:', paths)
      callback(paths)
    })
  },
})
