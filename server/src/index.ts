import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { getDb } from './db'
import { verifyToken } from './auth'
import { addConnection, removeConnection } from './realtime'

import authRoutes from './routes/auth'
import orgRoutes from './routes/orgs'
import clientRoutes from './routes/clients'
import projectRoutes from './routes/projects'
import archiveRoutes from './routes/archive'
import phaseRoutes from './routes/phases'
import meetingRoutes from './routes/meetings'
import todoRoutes from './routes/todos'
import userRoutes from './routes/users'
import sessionRoutes from './routes/time-sessions'
import templateRoutes from './routes/templates'
import routingRoutes from './routes/routing'
import assignmentRoutes from './routes/assignments'
import notificationRoutes from './routes/notifications'
import recentFilesRoutes from './routes/recent-files'
import orgFeaturesRoutes from './routes/org-features'
import commentRoutes from './routes/comments'
import emailPrefsRoutes from './routes/email-prefs'
import taskFilesRoutes from './routes/task-files'

// Initialise DB on startup (runs migrations)
getDb()

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health check (no auth)
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

app.use('/auth',          authRoutes)
app.use('/org',           orgRoutes)
app.use('/clients',       clientRoutes)
app.use('/projects',      projectRoutes)
app.use('/archive',       archiveRoutes)
app.use('/phases',        phaseRoutes)
app.use('/meetings',      meetingRoutes)
app.use('/todos',         todoRoutes)
app.use('/users',         userRoutes)
app.use('/sessions',      sessionRoutes)
app.use('/templates',     templateRoutes)
app.use('/routing',       routingRoutes)
app.use('/assignments',   assignmentRoutes)
app.use('/notifications', notificationRoutes)
app.use('/recent-files',  recentFilesRoutes)
app.use('/org-features',  orgFeaturesRoutes)
app.use('/comments',      commentRoutes)
app.use('/email-prefs',   emailPrefsRoutes)
app.use('/task-files',    taskFilesRoutes)

// ── WebSocket ──────────────────────────────────────────────────────────────────

const server = createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const token = url.searchParams.get('token')

  if (!token) {
    ws.close(4001, 'Token required')
    return
  }

  const payload = verifyToken(token)
  if (!payload) {
    ws.close(4001, 'Invalid or expired token')
    return
  }

  const { orgId } = payload
  addConnection(orgId, ws)

  // Heartbeat to keep connection alive through NAT/proxies
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping()
  }, 30_000)

  ws.on('close', () => {
    clearInterval(ping)
    removeConnection(orgId, ws)
  })

  ws.on('error', () => {
    clearInterval(ping)
    removeConnection(orgId, ws)
  })
})

import { networkInterfaces } from 'os'

const PORT = Number(process.env.PORT ?? 3847)

function getLanIP(): string {
  const nets = networkInterfaces()
  for (const iface of Object.values(nets)) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return 'localhost'
}

server.listen(PORT, () => {
  const ip = getLanIP()
  console.log('┌─────────────────────────────────────────────┐')
  console.log('│           Opus Flo Server running           │')
  console.log('├─────────────────────────────────────────────┤')
  console.log(`│  Local:    http://localhost:${PORT}            │`)
  console.log(`│  Network:  http://${ip}:${PORT}`.padEnd(47) + '│')
  console.log('├─────────────────────────────────────────────┤')
  console.log(`│  DB: ${(process.env.DB_PATH ?? './data/opus-flo.db').slice(0, 39).padEnd(39)} │`)
  console.log('└─────────────────────────────────────────────┘')
  console.log('  Give team members the Network URL above.')
})
