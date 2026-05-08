import { getDb } from '.'
import type { Todo, NewTodo, UpdateTodo, TaskStatus } from '../../shared/types'
import { routeTask } from './task_assignments'
import { notifyRoles } from './notifications'

const TODO_SELECT = `
  SELECT t.*, u.display_name as assigned_name, p.name as project_name
  FROM todos t
  LEFT JOIN users u ON t.assigned_to = u.id
  LEFT JOIN projects p ON t.project_id = p.id
`

function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function getOrgIdForTodo(todoId: number): number | null {
  const row = getDb().prepare(`
    SELECT p.organization_id FROM todos t JOIN projects p ON t.project_id = p.id WHERE t.id = ?
  `).get(todoId) as { organization_id: number } | undefined
  return row?.organization_id ?? null
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listTodos(projectId: number, phaseId?: number | null): Todo[] {
  if (phaseId !== undefined && phaseId !== null) {
    return getDb()
      .prepare(`${TODO_SELECT} WHERE t.project_id = ? AND t.phase_id = ? ORDER BY t.created_at ASC`)
      .all(projectId, phaseId) as Todo[]
  }
  return getDb()
    .prepare(`${TODO_SELECT} WHERE t.project_id = ? ORDER BY t.updated_at DESC`)
    .all(projectId) as Todo[]
}

export function getTodo(id: number): Todo | undefined {
  return getDb().prepare(`${TODO_SELECT} WHERE t.id = ?`).get(id) as Todo | undefined
}

export function createTodo(data: NewTodo): Todo {
  const status: TaskStatus = data.task_status ?? 'planning'
  const { lastInsertRowid } = getDb().prepare(`
    INSERT INTO todos (project_id, phase_id, assigned_to, title, description, priority, due_date, task_status, task_template_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.project_id,
    data.phase_id ?? null,
    data.assigned_to ?? null,
    data.title,
    data.description ?? '',
    data.priority ?? 'normal',
    data.due_date ?? null,
    status,
    data.task_template_id ?? null,
    now()
  )
  return getDb().prepare(`${TODO_SELECT} WHERE t.id = ?`).get(Number(lastInsertRowid)) as Todo
}

export function toggleTodo(id: number): Todo | undefined {
  const todo = getDb().prepare('SELECT * FROM todos WHERE id = ?').get(id) as Todo | undefined
  if (!todo) return undefined
  const isComplete = todo.task_status === 'complete'
  const newStatus: TaskStatus = isComplete ? 'planning' : 'complete'
  return updateTaskStatus(id, newStatus)
}

export function updateTodo(id: number, data: UpdateTodo): Todo | undefined {
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now()]
  if ('title' in data)       { fields.push('title = ?');       values.push(data.title) }
  if ('description' in data) { fields.push('description = ?'); values.push(data.description ?? '') }
  if ('priority' in data)    { fields.push('priority = ?');    values.push(data.priority) }
  if ('due_date' in data)    { fields.push('due_date = ?');    values.push(data.due_date ?? null) }
  if ('assigned_to' in data) { fields.push('assigned_to = ?'); values.push(data.assigned_to ?? null) }
  if ('phase_id' in data)    { fields.push('phase_id = ?');    values.push(data.phase_id ?? null) }
  values.push(id)
  getDb().prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return getDb().prepare(`${TODO_SELECT} WHERE t.id = ?`).get(id) as Todo | undefined
}

export function deleteTodo(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM todos WHERE id = ?').run(id)
  return changes > 0
}

// ── Status + Routing ──────────────────────────────────────────────────────────

/**
 * Update a task's status, apply routing rules, fire notifications.
 * @param actingUserId the user making the change (excluded from "assigned" notifications)
 */
export function updateTaskStatus(
  todoId: number,
  newStatus: TaskStatus,
  actingUserId?: number
): Todo | undefined {
  const db = getDb()
  const orgId = getOrgIdForTodo(todoId)
  const todo = getTodo(todoId)
  if (!todo) return undefined

  const isComplete = newStatus === 'complete'
  const completedAt = isComplete ? now() : null

  db.prepare(`
    UPDATE todos
    SET task_status = ?, completed = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, isComplete ? 1 : 0, completedAt, now(), todoId)

  // Apply routing
  if (orgId) {
    routeTask(todoId, newStatus, orgId)

    // Fire notifications on complete
    if (isComplete) {
      const msg = `Task "${todo.title}" in ${todo.project_name ?? 'a project'} has been marked complete.`
      notifyRoles({
        organization_id: orgId,
        roles: ['project_manager', 'lead_designer', 'admin'],
        todo_id: todoId,
        type: 'task_complete',
        message: msg,
        excludeUserId: actingUserId
      })
    }
  }

  return getDb().prepare(`${TODO_SELECT} WHERE t.id = ?`).get(todoId) as Todo | undefined
}

// ── User-scoped queries ───────────────────────────────────────────────────────

export function listOpenTodosForUser(userId: number): Todo[] {
  return getDb().prepare(`
    ${TODO_SELECT}
    JOIN task_assignments ta ON ta.todo_id = t.id AND ta.user_id = ?
    WHERE t.task_status != 'complete'
    ORDER BY t.updated_at DESC
  `).all(userId) as Todo[]
}

export function listRecentlyCompletedForUser(userId: number, days = 30): Todo[] {
  return getDb().prepare(`
    ${TODO_SELECT}
    WHERE t.assigned_to = ? AND t.task_status = 'complete'
      AND t.completed_at >= datetime('now', '-' || ? || ' days')
    ORDER BY t.completed_at DESC
  `).all(userId, days) as Todo[]
}

export function listAllOpenTasksForOrg(orgId: number): Todo[] {
  return getDb().prepare(`
    ${TODO_SELECT}
    WHERE p.organization_id = ? AND t.task_status != 'complete'
    ORDER BY t.updated_at DESC
  `).all(orgId) as Todo[]
}
