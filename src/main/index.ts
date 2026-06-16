import 'dotenv/config'
import { app, BrowserWindow, protocol, net, session, shell } from 'electron'
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
      sandbox: false,
      contextIsolation: true,
    }
  })

  // Block new windows; open http/https links in the system browser instead
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url).catch(() => {})
    }
    return { action: 'deny' }
  })

  // Prevent the renderer from navigating away from the app
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) {
      try {
        if (!navigationUrl.startsWith(new URL(devUrl).origin)) event.preventDefault()
      } catch {
        event.preventDefault()
      }
    } else {
      if (!navigationUrl.startsWith('file://')) event.preventDefault()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Deny all OS permission requests (camera, mic, notifications, geolocation, etc.)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  // Apply CSP in production only (Vite dev server manages its own headers in dev)
  if (!process.env['ELECTRON_RENDERER_URL']) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: asset:; font-src 'self' data:; connect-src 'self' http: https: ws: wss:; media-src 'self' blob:;"
          ]
        }
      })
    })
  }

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
