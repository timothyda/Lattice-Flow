import { getDb } from '.'
import type { Project, NewProject, UpdateProject } from '../shared/types'
import { getTemplatesByType } from './task_templates'

const PROJECT_SELECT = `
  SELECT p.*, c.name as client_name
  FROM projects p
  LEFT JOIN clients c ON p.client_id = c.id
`

export function listProjects(organizationId: number): Project[] {
  return getDb()
    .prepare(`${PROJECT_SELECT} WHERE p.organization_id = ? AND p.archived_at IS NULL ORDER BY p.created_at DESC`)
    .all(organizationId) as Project[]
}

export function listProjectsByClient(clientId: number): Project[] {
  return getDb()
    .prepare(`${PROJECT_SELECT} WHERE p.client_id = ? AND p.archived_at IS NULL ORDER BY p.name ASC`)
    .all(clientId) as Project[]
}

export function getProject(id: number): Project | undefined {
  return getDb().prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(id) as Project | undefined
}

export function createProject(data: NewProject): Project {
  const projectType = data.project_type ?? 'other'
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO projects (organization_id, client_id, name, description, nas_path, due_date, project_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(data.organization_id, data.client_id ?? null, data.name, data.description ?? '', data.nas_path ?? '', data.due_date ?? null, projectType)
  const project = getProject(Number(lastInsertRowid))!

  if (projectType !== 'other') {
    const templates = getTemplatesByType(data.organization_id, projectType)
    const insertTodo = getDb().prepare(`
      INSERT INTO todos (project_id, title, task_template_id, task_status, updated_at, created_at)
      VALUES (?, ?, ?, 'planning', datetime('now'), datetime('now'))
    `)
    for (const tpl of templates) {
      insertTodo.run(project.id, tpl.title, tpl.id)
    }
  }

  return project
}

export function updateProject(id: number, data: UpdateProject): Project | undefined {
  const UPDATABLE: (keyof UpdateProject)[] = ['client_id', 'name', 'description', 'nas_path', 'status', 'due_date', 'time_budget_hours']
  const cols = UPDATABLE.filter((k) => k in data)
  if (cols.length === 0) return getProject(id)
  const sql = `UPDATE projects SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
  getDb().prepare(sql).run(...cols.map((c) => data[c] ?? null), id)
  return getProject(id)
}

export function archiveProject(id: number): boolean {
  const { changes } = getDb()
    .prepare("UPDATE projects SET archived_at = datetime('now') WHERE id = ?")
    .run(id)
  return changes > 0
}

export function restoreProject(id: number): boolean {
  const { changes } = getDb().prepare('UPDATE projects SET archived_at = NULL WHERE id = ?').run(id)
  return changes > 0
}

export function deleteProject(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
  return changes > 0
}
