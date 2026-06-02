import WebSocket from 'ws'
import { BrowserWindow } from 'electron'
import { getServerUrl, getJwt } from './connection-store'

export type ConnectionState =
  | 'no_server'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'auth_expired'

let _state: ConnectionState = 'no_server'
let _ws: WebSocket | null = null
let _retryCount = 0
let _retryTimer: ReturnType<typeof setTimeout> | null = null

const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000, 60000]
const MAX_RETRIES = RETRY_DELAYS_MS.length

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function emitConnectionState(state: ConnectionState): void {
  _state = state
  broadcast('connection:state-changed', state)
}

export function getConnectionState(): ConnectionState {
  return _state
}

export function connect(): void {
  const baseUrl = getServerUrl()
  if (!baseUrl) { emitConnectionState('no_server'); return }

  const jwt = getJwt()
  if (!jwt) { emitConnectionState('auth_expired'); return }

  emitConnectionState(_retryCount > 0 ? 'reconnecting' : 'connecting')

  const wsUrl = baseUrl.replace(/^http/, 'ws') + `?token=${encodeURIComponent(jwt)}`
  _ws = new WebSocket(wsUrl)

  _ws.on('open', () => {
    _retryCount = 0
    emitConnectionState('connected')
  })

  _ws.on('message', (data) => {
    try {
      broadcast('ws:event', JSON.parse(data.toString()))
    } catch { /* malformed */ }
  })

  _ws.on('close', (code) => {
    _ws = null
    if (code === 4001) {
      emitConnectionState('auth_expired')
      return
    }
    if (_retryCount >= MAX_RETRIES) {
      emitConnectionState('disconnected')
      return
    }
    const delay = RETRY_DELAYS_MS[Math.min(_retryCount, RETRY_DELAYS_MS.length - 1)]
    _retryCount++
    emitConnectionState('reconnecting')
    _retryTimer = setTimeout(connect, delay)
  })

  _ws.on('error', () => {
    // close event fires immediately after — let it drive retry logic
  })
}

export function disconnect(): void {
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null }
  if (_ws) { _ws.removeAllListeners(); _ws.close(); _ws = null }
}

export function resetAndConnect(): void {
  disconnect()
  _retryCount = 0
  connect()
}

export function retryConnection(): void {
  disconnect()
  _retryCount = 0
  connect()
}
