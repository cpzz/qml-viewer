import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { readFile, writeFile } from './fileOps'

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
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
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
