import { getDb } from '.'
import { getUserById } from './users'
import type { TimeSession, ManualSessionData } from '../shared/types'

const SESSION_SELECT = `
  SELECT ts.*, t.title as todo_title
  FROM time_sessions ts
  LEFT JOIN todos t ON ts.todo_id = t.id
`

function getSession(id: number): TimeSession | undefined {
  return getDb().prepare(`${SESSION_SELECT} WHERE ts.id = ?`).get(id) as TimeSession | undefined
}

export function clockIn(projectId: number, userId: number, todoId?: number | null): TimeSession {
  const user = getUserById(userId)
  if (!user) throw new Error(`User ${userId} not found`)

  const { lastInsertRowid } = getDb()
    .prepare(`INSERT INTO time_sessions (project_id, user_id, user_name, todo_id, started_at) VALUES (?, ?, ?, ?, datetime('now'))`)
    .run(projectId, userId, user.display_name, todoId ?? null)

  return getSession(Number(lastInsertRowid))!
}

export function clockOut(sessionId: number, note?: string, subtaskTitle?: string | null): TimeSession | undefined {
  const session = getSession(sessionId)
  if (!session || session.ended_at) return session

  const nowMs = Date.now()
  const startedAt = new Date(session.started_at.replace(' ', 'T') + 'Z')
  const durationMinutes = Math.max(0, Math.round((nowMs - startedAt.getTime()) / 60_000))
  const endedAt = new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19)

  getDb()
    .prepare('UPDATE time_sessions SET ended_at = ?, duration_minutes = ?, note = ?, subtask_title = ? WHERE id = ?')
    .run(endedAt, durationMinutes, note ?? null, subtaskTitle ?? null, sessionId)

  return getSession(sessionId)
}

export function getActiveSessions(projectId: number): TimeSession[] {
  return getDb()
    .prepare(`${SESSION_SELECT} WHERE ts.project_id = ? AND ts.ended_at IS NULL ORDER BY ts.started_at ASC`)
    .all(projectId) as TimeSession[]
}

export function getSessionsByProject(projectId: number): TimeSession[] {
  return getDb()
    .prepare(`${SESSION_SELECT} WHERE ts.project_id = ? ORDER BY ts.started_at DESC`)
    .all(projectId) as TimeSession[]
}

export function getSessionsByTodo(todoId: number): TimeSession[] {
  return getDb()
    .prepare(`${SESSION_SELECT} WHERE ts.todo_id = ? ORDER BY ts.started_at DESC`)
    .all(todoId) as TimeSession[]
}

export function logSessionManually(data: ManualSessionData): TimeSession {
  const { lastInsertRowid } = getDb()
    .prepare(`
      INSERT INTO time_sessions (project_id, user_id, user_name, todo_id, subtask_title, started_at, ended_at, duration_minutes, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(data.project_id, data.user_id, data.user_name, data.todo_id ?? null, data.subtask_title ?? null, data.started_at, data.ended_at, data.duration_minutes, data.note)
  return getSession(Number(lastInsertRowid))!
}

export function deleteSession(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM time_sessions WHERE id = ?').run(id)
  return changes > 0
}

export function exportSessionsCSV(projectId: number): string {
  interface Row {
    started_at: string; ended_at: string; user_name: string; email: string | null
    todo_title: string | null; subtask_title: string | null; duration_minutes: number | null; note: string | null
  }

  const rows = getDb().prepare(`
    SELECT ts.started_at, ts.ended_at, ts.user_name, u.email, t.title as todo_title,
           ts.subtask_title, ts.duration_minutes, ts.note
    FROM time_sessions ts
    LEFT JOIN users u ON ts.user_id = u.id
    LEFT JOIN todos t ON ts.todo_id = t.id
    WHERE ts.project_id = ? AND ts.ended_at IS NOT NULL
    ORDER BY ts.started_at ASC
  `).all(projectId) as Row[]

  const toLocalDate = (utc: string) => new Date(utc.replace(' ', 'T') + 'Z').toLocaleDateString('en-CA')
  const toLocalTime = (utc: string) => {
    const d = new Date(utc.replace(' ', 'T') + 'Z')
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const escape = (v: string | null | undefined): string => {
    if (v == null || v === '') return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }

  const header = 'date,name,email,task,subtask,time_in,time_out,duration_hrs,note'
  const lines = rows.map((r) => [
    toLocalDate(r.started_at), escape(r.user_name), escape(r.email),
    escape(r.todo_title), escape(r.subtask_title),
    toLocalTime(r.started_at), toLocalTime(r.ended_at),
    r.duration_minutes != null ? (r.duration_minutes / 60).toFixed(2) : '',
    escape(r.note)
  ].join(','))

  return [header, ...lines].join('\r\n')
}
