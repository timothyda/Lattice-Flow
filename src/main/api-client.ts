import { getServerUrl, getJwt } from './connection-store'

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

// Lazily import to avoid circular deps at startup
let _emitAuthExpired: (() => void) | null = null
export function setAuthExpiredCallback(cb: () => void): void {
  _emitAuthExpired = cb
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const baseUrl = getServerUrl()
  if (!baseUrl) throw new Error('No server configured')

  const jwt = getJwt()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`

  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch (err) {
    throw Object.assign(new Error('Network error'), { code: 'NETWORK_ERROR', cause: err })
  }

  if (res.status === 401) {
    _emitAuthExpired?.()
    throw Object.assign(new Error('Session expired'), { code: 'AUTH_EXPIRED' })
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error ?? res.statusText)
  }

  // Some endpoints return no body (204) or plain text (CSV)
  const contentType = res.headers.get('content-type') ?? ''
  if (res.status === 204 || !contentType.includes('application/json')) {
    return undefined as unknown as T
  }

  return res.json() as Promise<T>
}

export async function ping(baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(5000) })
    return res.ok ? { ok: true } : { ok: false, error: `Server returned ${res.status}` }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function downloadText(path: string): Promise<string> {
  const baseUrl = getServerUrl()
  if (!baseUrl) throw new Error('No server configured')
  const jwt = getJwt()
  const headers: Record<string, string> = {}
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`
  const res = await fetch(`${baseUrl}${path}`, { headers })
  if (!res.ok) throw new Error(res.statusText)
  return res.text()
}

export const apiClient = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH',  path, body),
  put:    <T>(path: string, body?: unknown) => request<T>('PUT',    path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}
