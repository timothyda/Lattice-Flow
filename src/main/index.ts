import 'dotenv/config'
import { app, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { getDb } from './db'
import { registerIpcHandlers } from './ipc'

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'asset', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Serve local files for image/PDF preview via asset:// URLs
  protocol.handle('asset', (request) => {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path') ?? ''
    if (!filePath) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(filePath).href)
  })

  getDb()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
