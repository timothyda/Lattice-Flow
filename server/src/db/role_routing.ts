import { getDb } from '.'
import type { TaskStatus, UserRole } from '../shared/types'
import { STATUS_ROUTING } from '../shared/types'

export const ROUTABLE_STATUSES: TaskStatus[] = [
  'ready_for_design', 'ready_for_review', 'need_it', 'hold', 'pm_in_progress'
]

export function seedDefaultRouting(orgId: number): void {
  const db = getDb()
  const { c } = db.prepare('SELECT COUNT(*) as c FROM role_routing WHERE organization_id = ?').get(orgId) as { c: number }
  if (c > 0) return

  const insert = db.prepare('INSERT OR IGNORE INTO role_routing (organization_id, role, task_status) VALUES (?, ?, ?)')
  for (const [status, roles] of Object.entries(STATUS_ROUTING) as [TaskStatus, UserRole[]][]) {
    for (const role of roles) {
      insert.run(orgId, role, status)
    }
  }
}

export function getOrgRouting(orgId: number): Partial<Record<TaskStatus, UserRole[]>> {
  const rows = getDb().prepare('SELECT role, task_status FROM role_routing WHERE organization_id = ?')
    .all(orgId) as { role: UserRole; task_status: TaskStatus }[]

  if (rows.length === 0) return STATUS_ROUTING

  const routing: Partial<Record<TaskStatus, UserRole[]>> = {}
  for (const row of rows) {
    if (!routing[row.task_status]) routing[row.task_status] = []
    routing[row.task_status]!.push(row.role)
  }
  return routing
}

export function getRoutingByRole(orgId: number): Partial<Record<UserRole, TaskStatus[]>> {
  const rows = getDb().prepare('SELECT role, task_status FROM role_routing WHERE organization_id = ?')
    .all(orgId) as { role: UserRole; task_status: TaskStatus }[]

  if (rows.length === 0) {
    const result: Partial<Record<UserRole, TaskStatus[]>> = {}
    for (const [status, roles] of Object.entries(STATUS_ROUTING) as [TaskStatus, UserRole[]][]) {
      for (const role of roles) {
        if (!result[role]) result[role] = []
        result[role]!.push(status as TaskStatus)
      }
    }
    return result
  }

  const result: Partial<Record<UserRole, TaskStatus[]>> = {}
  for (const row of rows) {
    if (!result[row.role]) result[row.role] = []
    result[row.role]!.push(row.task_status)
  }
  return result
}

export function setRoleRouting(orgId: number, role: UserRole, statuses: TaskStatus[]): void {
  const db = getDb()
  const { c } = db.prepare('SELECT COUNT(*) as c FROM role_routing WHERE organization_id = ?').get(orgId) as { c: number }
  if (c === 0) seedDefaultRouting(orgId)

  db.prepare('DELETE FROM role_routing WHERE organization_id = ? AND role = ?').run(orgId, role)
  const insert = db.prepare('INSERT OR IGNORE INTO role_routing (organization_id, role, task_status) VALUES (?, ?, ?)')
  for (const s of statuses) {
    insert.run(orgId, role, s)
  }
}
