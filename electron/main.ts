import { app, BrowserWindow, ipcMain, dialog, Menu, clipboard, net } from 'electron'
import { fileURLToPath } from 'node:url'
import { join, basename } from 'node:path'
import { stat } from 'node:fs/promises'
import { readFile, writeFile, readFileByPath, readDirectory, listQmlFilesInDirectory } from './fileOps'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  Menu.setApplicationMenu(null)
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools()
    }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('file:new', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [{ name: 'QML Files', extensions: ['qml'] }],
    defaultPath: 'untitled.qml',
  })
  if (result.canceled || !result.filePath) return null
  const template = ''
  await writeFile(result.filePath, template)
  return { filePath: result.filePath, content: template }
})

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'QML Files', extensions: ['qml'] }],
  })
  
  if (result.canceled || result.filePaths.length === 0) return null
  
  const filePath = result.filePaths[0]
  const content = await readFile(filePath)
  return { filePath, content }
})

ipcMain.handle('file:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'QML Files', extensions: ['qml'] }],
  })

  if (result.canceled || result.filePaths.length === 0) return []

  const files = [] as Array<{ filePath: string; content: string }>
  for (const filePath of result.filePaths) {
    const content = await readFile(filePath)
    files.push({ filePath, content })
  }
  return files
})

ipcMain.handle('file:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) return []

  // 返回目录项本身，让用户可以展开查看
  const dirPath = result.filePaths[0]
  const dirName = dirPath.split(/[\\/]/).pop() || 'directory'
  return [{ name: dirName, path: dirPath, type: 'directory' }]
})

ipcMain.handle('file:save', async (_event, content: string, filePath?: string) => {
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow!, {
      filters: [{ name: 'QML Files', extensions: ['qml'] }],
    })
    if (result.canceled || !result.filePath) return null
    filePath = result.filePath
  }
  await writeFile(filePath, content)
  return filePath
})

ipcMain.handle('file:readByPath', async (_event, filePath: string) => {
  return await readFileByPath(filePath)
})

ipcMain.handle('file:readDirectory', async (_event, dirPath: string) => {
  return await readDirectory(dirPath)
})
// 转发拖拽文件路径到渲染进程（preload 发送 files-dropped 到主进程，再广播回渲染进程）
ipcMain.on('files-dropped', (_event, paths: string[]) => {
  if (mainWindow) {
    mainWindow.webContents.send('files-dropped', paths)
  }
})

ipcMain.handle('file:statBatch', async (_event, filePaths: string[]) => {
  const results = []
  for (const p of filePaths) {
    try {
      const s = await stat(p)
      results.push({ path: p, name: basename(p), type: s.isDirectory() ? 'directory' : 'file' })
    } catch { /* skip */ }
  }
  return results
})

ipcMain.handle('qml:readText', async (_event, filePath: string) => readFile(filePath))
ipcMain.handle('qml:writeText', async (_event, filePath: string, content: string) => {
  await writeFile(filePath, content)
})
ipcMain.handle('qml:fetchText', async (_event, url: string) => {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported QML network protocol ${parsed.protocol}`)
  }
  const response = await net.fetch(parsed.toString())
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
  }
})
ipcMain.handle('qml:clipboardRead', () => clipboard.readText())
ipcMain.handle('qml:clipboardWrite', (_event, text: string) => clipboard.writeText(text))
