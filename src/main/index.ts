import 'dotenv/config'
import { app, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { registerIpcHandlers } from './ipc'
import { getServerUrl } from './connection-store'
import { connect, emitConnectionState } from './ws-client'
import { restoreSession } from './auth'
import { setAuthExpiredCallback } from './api-client'

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

app.whenReady().then(async () => {
  // Serve local files for image/PDF preview via asset:// URLs
  protocol.handle('asset', (request) => {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path') ?? ''
    if (!filePath) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(filePath).href)
  })

  // Wire up auth-expired → emit to renderer
  setAuthExpiredCallback(() => emitConnectionState('auth_expired'))

  registerIpcHandlers()
  createWindow()

  // After window is ready: initialise server connection
  if (getServerUrl()) {
    await restoreSession()
    connect()
  } else {
    emitConnectionState('no_server')
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
