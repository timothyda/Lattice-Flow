import { WebSocket } from 'ws'

const connections = new Map<number, Set<WebSocket>>()

export function addConnection(orgId: number, ws: WebSocket): void {
  if (!connections.has(orgId)) connections.set(orgId, new Set())
  connections.get(orgId)!.add(ws)
}

export function removeConnection(orgId: number, ws: WebSocket): void {
  connections.get(orgId)?.delete(ws)
}

export function broadcast(orgId: number, event: string, payload: unknown): void {
  const org = connections.get(orgId)
  if (!org) return
  const msg = JSON.stringify({ event, payload })
  for (const ws of org) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  }
}
