import { getDb } from '.'
import type { TaskComment } from '../shared/types'
import { createNotification } from './notifications'

export function listComments(todoId: number): TaskComment[] {
  return getDb().prepare('SELECT * FROM task_comments WHERE todo_id = ? ORDER BY created_at ASC').all(todoId) as TaskComment[]
}

export function addComment(todoId: number, userId: number, userName: string, content: string, orgId: number | null): TaskComment {
  const db = getDb()
  const { lastInsertRowid } = db
    .prepare('INSERT INTO task_comments (todo_id, user_id, user_name, content) VALUES (?, ?, ?, ?)')
    .run(todoId, userId, userName, content)
  const commentId = Number(lastInsertRowid)

  if (orgId) {
    const orgUsers = db.prepare('SELECT id, display_name FROM users WHERE organization_id = ?').all(orgId) as { id: number; display_name: string }[]
    const todo = db.prepare(`
      SELECT t.title, p.name as project_name FROM todos t JOIN projects p ON t.project_id = p.id WHERE t.id = ?
    `).get(todoId) as { title: string; project_name: string } | undefined

    const insertMention = db.prepare('INSERT OR IGNORE INTO comment_mentions (comment_id, user_id) VALUES (?, ?)')
    for (const user of orgUsers) {
      if (user.id === userId) continue
      if (content.toLowerCase().includes(`@${user.display_name.toLowerCase()}`)) {
        insertMention.run(commentId, user.id)
        if (todo) {
          createNotification({
            organization_id: orgId,
            user_id: user.id,
            todo_id: todoId,
            type: 'mention',
            message: `${userName} mentioned you in a comment on "${todo.title}"`,
          })
        }
      }
    }
  }

  return db.prepare('SELECT * FROM task_comments WHERE id = ?').get(commentId) as TaskComment
}

export function deleteComment(id: number, userId: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM task_comments WHERE id = ? AND user_id = ?').run(id, userId)
  return changes > 0
}

export function markCommentsRead(todoId: number, userId: number): void {
  getDb().prepare(`
    INSERT INTO comment_reads (todo_id, user_id, last_read_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(todo_id, user_id) DO UPDATE SET last_read_at = datetime('now')
  `).run(todoId, userId)
}

export function getUnreadCountsForTodos(todoIds: number[], userId: number): Record<number, number> {
  if (todoIds.length === 0) return {}
  const placeholders = todoIds.map(() => '?').join(',')
  const rows = getDb().prepare(`
    SELECT tc.todo_id, COUNT(*) as n
    FROM task_comments tc
    WHERE tc.todo_id IN (${placeholders})
      AND tc.user_id != ?
      AND tc.created_at > COALESCE(
        (SELECT last_read_at FROM comment_reads cr WHERE cr.todo_id = tc.todo_id AND cr.user_id = ?),
        '1970-01-01'
      )
    GROUP BY tc.todo_id
  `).all(...todoIds, userId, userId) as { todo_id: number; n: number }[]
  return Object.fromEntries(rows.map((r) => [r.todo_id, r.n]))
}
