import { createServer } from 'http'
import { AddressInfo } from 'net'
import { randomBytes, createHash } from 'crypto'
import { shell } from 'electron'

export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export interface OAuthResult {
  code: string
  redirectUri: string
  verifier: string
  state: string
}

export function runOAuthFlow(
  buildAuthUrl: (redirectUri: string, state: string, challenge: string) => string
): Promise<OAuthResult> {
  const { verifier, challenge } = generatePKCE()
  const state = randomBytes(16).toString('hex')

  return new Promise((resolve, reject) => {
    let redirectUri = ''

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url!, 'http://localhost')
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')
        const error = url.searchParams.get('error')

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(code
          ? '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2 style="color:#0073ea">&#10003; Connected!</h2><p>You can close this tab and return to PM App.</p></body></html>'
          : `<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2 style="color:#e2445c">Connection failed</h2><p>${error ?? 'No code returned'}</p></body></html>`
        )
        server.close()

        if (!code) { reject(new Error(error ?? 'No authorization code returned')); return }
        if (returnedState !== state) { reject(new Error('OAuth state mismatch — possible CSRF')); return }
        resolve({ code, redirectUri, verifier, state })
      } catch (e) { reject(e) }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      redirectUri = `http://localhost:${port}/callback`
      shell.openExternal(buildAuthUrl(redirectUri, state, challenge)).catch(reject)
    })

    server.on('error', reject)
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth timeout — no response within 5 minutes'))
    }, 300_000)
  })
}

export async function exchangeCode(
  tokenUrl: string,
  params: Record<string, string>,
  basicAuth?: string
): Promise<{ accessToken: string; refreshToken: string; expiresInMs: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (basicAuth) headers['Authorization'] = `Basic ${basicAuth}`

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(params).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiresInMs: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}
