import { getDb } from '.'
import type { Todo, NewTodo, UpdateTodo, TaskStatus, RecurrenceFrequency } from '../../shared/types'
import { routeTask } from './task_assignments'
import { notifyRoles } from './notifications'

function nextRecurrenceDate(freq: RecurrenceFrequency): string {
  const d = new Date()
  switch (freq) {
    case 'day':      d.setDate(d.getDate() + 1); break
    case 'week':     d.setDate(d.getDate() + 7); break
    case 'biweekly': d.setDate(d.getDate() + 14); break
    case 'monthly':  d.setMonth(d.getMonth() + 1); break
    case '3months':  d.setMonth(d.getMonth() + 3); break
    case '6months':  d.setMonth(d.getMonth() + 6); break
    case 'yearly':   d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().slice(0, 10)
}

const TODO_SELECT = `
  SELECT t.*, u.display_name as assigned_name, u.avatar_url as assigned_avatar_url, p.name as project_name
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
  const isRecurring = data.is_recurring ? 1 : 0
  const recurrenceFreq = isRecurring ? (data.recurrence_frequency ?? null) : null
  const recurrenceNextDate = isRecurring && recurrenceFreq
    ? (data.due_date ?? nextRecurrenceDate(recurrenceFreq))
    : null
  const { lastInsertRowid } = getDb().prepare(`
    INSERT INTO todos (project_id, phase_id, assigned_to, title, description, priority, start_date, due_date, task_status, task_template_id, is_recurring, recurrence_frequency, recurrence_next_date, estimated_minutes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.project_id,
    data.phase_id ?? null,
    data.assigned_to ?? null,
    data.title,
    data.description ?? '',
    data.priority ?? 'normal',
    data.start_date ?? null,
    data.due_date ?? null,
    status,
    data.task_template_id ?? null,
    isRecurring,
    recurrenceFreq,
    recurrenceNextDate,
    data.estimated_minutes ?? null,
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
  if ('title' in data)                { fields.push('title = ?');                values.push(data.title) }
  if ('description' in data)          { fields.push('description = ?');          values.push(data.description ?? '') }
  if ('priority' in data)             { fields.push('priority = ?');             values.push(data.priority) }
  if ('start_date' in data)           { fields.push('start_date = ?');           values.push(data.start_date ?? null) }
  if ('due_date' in data)             { fields.push('due_date = ?');             values.push(data.due_date ?? null) }
  if ('assigned_to' in data)          { fields.push('assigned_to = ?');          values.push(data.assigned_to ?? null) }
  if ('phase_id' in data)             { fields.push('phase_id = ?');             values.push(data.phase_id ?? null) }
  if ('is_recurring' in data)         { fields.push('is_recurring = ?');         values.push(data.is_recurring ? 1 : 0) }
  if ('recurrence_frequency' in data) { fields.push('recurrence_frequency = ?'); values.push(data.recurrence_frequency ?? null) }
  if ('estimated_minutes' in data)    { fields.push('estimated_minutes = ?');    values.push(data.estimated_minutes ?? null) }
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

  // Auto-regenerate recurring tasks
  if (isComplete && todo.is_recurring && todo.recurrence_frequency) {
    const nextDate = nextRecurrenceDate(todo.recurrence_frequency)
    db.prepare(`
      INSERT INTO todos (project_id, phase_id, assigned_to, title, description, priority, due_date, task_status, task_template_id, is_recurring, recurrence_frequency, recurrence_next_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, 1, ?, ?, ?)
    `).run(
      todo.project_id, todo.phase_id ?? null, todo.assigned_to ?? null,
      todo.title, todo.description, todo.priority, nextDate,
      todo.task_template_id ?? null, todo.recurrence_frequency, nextDate, now()
    )
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
