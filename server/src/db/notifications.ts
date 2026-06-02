import { getDb } from '.'
import type { AppNotification, NotificationType } from '../shared/types'

const SELECT = `
  SELECT n.*, t.title as todo_title, p.name as project_name
  FROM notifications n
  LEFT JOIN todos t ON n.todo_id = t.id
  LEFT JOIN projects p ON t.project_id = p.id
`

export function createNotification(data: {
  organization_id: number
  user_id: number
  todo_id: number | null
  type: NotificationType
  message: string
}): AppNotification {
  const { lastInsertRowid } = getDb().prepare(`
    INSERT INTO notifications (organization_id, user_id, todo_id, type, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.organization_id, data.user_id, data.todo_id ?? null, data.type, data.message)
  return getDb().prepare(`${SELECT} WHERE n.id = ?`).get(Number(lastInsertRowid)) as AppNotification
}

export function notifyRoles(data: {
  organization_id: number
  roles: string[]
  todo_id: number | null
  type: NotificationType
  message: string
  excludeUserId?: number
}): void {
  const db = getDb()
  const placeholders = data.roles.map(() => '?').join(', ')
  const users = db.prepare(
    `SELECT id FROM users WHERE organization_id = ? AND role IN (${placeholders})`
  ).all(data.organization_id, ...data.roles) as { id: number }[]

  const insert = db.prepare(`
    INSERT INTO notifications (organization_id, user_id, todo_id, type, message)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const u of users) {
    if (u.id === data.excludeUserId) continue
    insert.run(data.organization_id, u.id, data.todo_id ?? null, data.type, data.message)
  }
}

export function listNotifications(userId: number, limit = 30): AppNotification[] {
  return getDb().prepare(`${SELECT} WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ?`)
    .all(userId, limit) as AppNotification[]
}

export function getUnreadCount(userId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0')
    .get(userId) as { count: number }
  return row.count
}

export function markRead(notificationId: number): void {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(notificationId)
}

export function markAllRead(userId: number): void {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId)
}
