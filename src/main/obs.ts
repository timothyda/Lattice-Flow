import WebSocket from 'ws'
import { createHash } from 'crypto'

function makeAuthResponse(password: string, salt: string, challenge: string): string {
  const secret = createHash('sha256').update(password + salt).digest('base64')
  return createHash('sha256').update(secret + challenge).digest('base64')
}

type PendingRequest = { resolve: (data: unknown) => void; reject: (err: Error) => void }

class OBSClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  connect(host: string, port: number, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://${host}:${port}`
      const sock = new WebSocket(url)
      this.ws = sock

      const timeout = setTimeout(() => {
        sock.terminate()
        reject(new Error('OBS connection timed out — is OBS running with WebSocket enabled?'))
      }, 5000)

      sock.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as { op: number; d: Record<string, unknown> }

          if (msg.op === 0) {
            // Hello — send Identify
            const auth = msg.d.authentication as { challenge: string; salt: string } | undefined
            const identifyData: Record<string, unknown> = { rpcVersion: 1 }
            if (auth && password) {
              identifyData.authentication = makeAuthResponse(password, auth.salt, auth.challenge)
            }
            sock.send(JSON.stringify({ op: 1, d: identifyData }))
          }

          if (msg.op === 2) {
            // Identified — connected
            clearTimeout(timeout)
            resolve()
          }

          if (msg.op === 7) {
            // RequestResponse
            const d = msg.d as { requestId: string; requestStatus: { result: boolean; comment?: string }; responseData?: unknown }
            const req = this.pending.get(d.requestId)
            if (req) {
              this.pending.delete(d.requestId)
              if (d.requestStatus.result) req.resolve(d.responseData ?? {})
              else req.reject(new Error(d.requestStatus.comment ?? 'OBS request failed'))
            }
          }
        } catch { /* ignore parse errors */ }
      })

      sock.on('error', (err) => { clearTimeout(timeout); reject(err) })
      sock.on('close', () => { this.ws = null; this.pending.clear() })
    })
  }

  call(type: string, data: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || !this.connected) return Promise.reject(new Error('Not connected to OBS'))
    const requestId = Math.random().toString(36).slice(2)
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.ws!.send(JSON.stringify({ op: 6, d: { requestType: type, requestId, requestData: data } }))
    })
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }
}

export const obsClient = new OBSClient()

export async function connectOBS(host: string, port: number, password: string): Promise<void> {
  if (obsClient.connected) return
  await obsClient.connect(host, port, password)
}

export async function startOBSRecord(): Promise<void> {
  await obsClient.call('StartRecord')
}

export async function stopOBSRecord(): Promise<string> {
  const result = await obsClient.call('StopRecord') as { outputPath?: string }
  return result?.outputPath ?? ''
}

export function disconnectOBS(): void {
  obsClient.disconnect()
}
