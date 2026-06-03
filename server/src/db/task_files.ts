import { getDb } from '.'
import type { TaskFile } from '../shared/types'

export function listTaskFiles(todoId: number): TaskFile[] {
  return getDb()
    .prepare('SELECT * FROM task_files WHERE todo_id = ? ORDER BY created_at ASC')
    .all(todoId) as TaskFile[]
}

export function addTaskFile(todoId: number, filePath: string, fileName: string): TaskFile {
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO task_files (todo_id, file_path, file_name) VALUES (?, ?, ?)')
    .run(todoId, filePath, fileName)
  return getDb()
    .prepare('SELECT * FROM task_files WHERE id = ?')
    .get(Number(lastInsertRowid)) as TaskFile
}

export function removeTaskFile(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM task_files WHERE id = ?').run(id)
  return changes > 0
}
