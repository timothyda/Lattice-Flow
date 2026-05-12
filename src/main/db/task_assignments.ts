import { getDb } from '.'
import type { TaskAssignment, TaskStatus } from '../../shared/types'
import { getOrgRouting } from './role_routing'
import { createNotification } from './notifications'

// ── Routing logic ─────────────────────────────────────────────────────────────

/**
 * Apply routing rules when a task's status changes.
 * - For statuses with routing roles: replace all assignments with users who have those roles.
 * - For 'hold': additionally remove assignments for any role NOT in the hold routing set.
 * - For 'complete' / 'planning': clear all assignments.
 * - For 'in_progress': leave existing assignments unchanged.
 */
export function routeTask(todoId: number, newStatus: TaskStatus, orgId: number, actingUserId?: number): void {
  const db = getDb()

  if (newStatus === 'in_progress') return  // keep whoever is assigned

  if (newStatus === 'complete' || newStatus === 'planning') {
    db.prepare('DELETE FROM task_assignments WHERE todo_id = ?').run(todoId)
    return
  }

  const routing = getOrgRouting(orgId)
  const targetRoles = routing[newStatus]
  if (!targetRoles || targetRoles.length === 0) return

  if (newStatus === 'hold') {
    // Remove users whose role is NOT in the hold target roles
    const placeholders = targetRoles.map(() => '?').join(', ')
    db.prepare(`
      DELETE FROM task_assignments
      WHERE todo_id = ?
        AND user_id IN (
          SELECT id FROM users
          WHERE organization_id = ? AND role NOT IN (${placeholders}) AND role != 'admin'
        )
    `).run(todoId, orgId, ...targetRoles)
  } else {
    // Clear all assignments and reassign to target roles
    db.prepare('DELETE FROM task_assignments WHERE todo_id = ?').run(todoId)
  }

  // Insert new assignments for all users with the target roles
  const targetUsers = db.prepare(`
    SELECT id FROM users WHERE organization_id = ? AND role IN (${targetRoles.map(() => '?').join(', ')})
  `).all(orgId, ...targetRoles) as { id: number }[]

  const todo = db.prepare('SELECT title FROM todos WHERE id = ?').get(todoId) as { title: string } | undefined

  const insert = db.prepare(
    'INSERT OR IGNORE INTO task_assignments (todo_id, user_id) VALUES (?, ?)'
  )
  for (const u of targetUsers) {
    insert.run(todoId, u.id)
    if (u.id !== actingUserId && todo) {
      createNotification({
        organization_id: orgId,
        user_id: u.id,
        todo_id: todoId,
        type: 'task_assigned',
        message: `You have been assigned to "${todo.title}"`
      })
    }
  }
}

// ── Assignment queries ────────────────────────────────────────────────────────

export function getAssignmentsForTodo(todoId: number): TaskAssignment[] {
  return getDb().prepare(`
    SELECT ta.*, u.display_name
    FROM task_assignments ta
    JOIN users u ON ta.user_id = u.id
    WHERE ta.todo_id = ?
    ORDER BY ta.assigned_at ASC
  `).all(todoId) as TaskAssignment[]
}

/** Tasks assigned to a specific user that aren't complete, ordered newest-updated first. */
export function getOpenTasksForUser(userId: number): unknown[] {
  return getDb().prepare(`
    SELECT t.*, p.name as project_name, u.display_name as assigned_name
    FROM task_assignments ta
    JOIN todos t ON ta.todo_id = t.id
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE ta.user_id = ?
      AND t.task_status != 'complete'
    ORDER BY t.updated_at DESC
  `).all(userId)
}

/** All open tasks across an org, newest-updated first (for admins / PMs). */
export function getAllOpenTasksForOrg(orgId: number): unknown[] {
  return getDb().prepare(`
    SELECT t.*, p.name as project_name, u.display_name as assigned_name
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE p.organization_id = ?
      AND t.task_status != 'complete'
    ORDER BY t.updated_at DESC
  `).all(orgId)
}

export function removeUserFromTask(todoId: number, userId: number): void {
  getDb().prepare('DELETE FROM task_assignments WHERE todo_id = ? AND user_id = ?').run(todoId, userId)
}

export function assignUserToTask(todoId: number, userId: number): void {
  getDb().prepare('INSERT OR IGNORE INTO task_assignments (todo_id, user_id) VALUES (?, ?)').run(todoId, userId)
}
