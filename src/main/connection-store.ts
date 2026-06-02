import { safeStorage, app } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import Store from 'electron-store'

const store = new Store<{ serverUrl: string | null }>({
  name: 'connection',
  defaults: { serverUrl: null }
})

// ── Server URL (not sensitive — plain store) ───────────────────────────────────

export function getServerUrl(): string | null {
  return store.get('serverUrl', null) as string | null
}

export function setServerUrl(url: string): void {
  store.set('serverUrl', url.replace(/\/+$/, ''))
}

export function clearServerUrl(): void {
  store.set('serverUrl', null)
}

// ── JWT (sensitive — safeStorage encrypted) ───────────────────────────────────

function tokenPath(): string {
  return join(app.getPath('userData'), 'token.enc')
}

export function getJwt(): string | null {
  try {
    if (!existsSync(tokenPath())) return null
    const encrypted = readFileSync(tokenPath())
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

export function setJwt(token: string): void {
  try {
    const encrypted = safeStorage.encryptString(token)
    writeFileSync(tokenPath(), encrypted)
  } catch (err) {
    console.error('[connection-store] failed to save token:', err)
  }
}

export function clearJwt(): void {
  try { unlinkSync(tokenPath()) } catch {}
}
