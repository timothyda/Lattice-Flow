import { getDb } from '.'
import type { RecentFile } from '../shared/types'

const SELECT = `
  SELECT rf.*, p.name as project_name
  FROM recent_files rf
  LEFT JOIN projects p ON rf.project_id = p.id
`

export function recordFileAccess(userId: number, projectId: number, filePath: string, fileName: string): void {
  const db = getDb()
  db.prepare('DELETE FROM recent_files WHERE user_id = ? AND file_path = ?').run(userId, filePath)
  db.prepare('INSERT INTO recent_files (user_id, project_id, file_path, file_name) VALUES (?, ?, ?, ?)').run(userId, projectId, filePath, fileName)
  db.prepare(`
    DELETE FROM recent_files WHERE user_id = ? AND id NOT IN (
      SELECT id FROM recent_files WHERE user_id = ? ORDER BY accessed_at DESC LIMIT 50
    )
  `).run(userId, userId)
}

export function listRecentFiles(userId: number, limit = 10): RecentFile[] {
  return getDb()
    .prepare(`${SELECT} WHERE rf.user_id = ? ORDER BY rf.accessed_at DESC LIMIT ?`)
    .all(userId, limit) as RecentFile[]
}
