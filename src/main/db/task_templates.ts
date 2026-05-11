import { getDb } from '.'
import type { TaskTemplate, TaskTemplateSubtask, ProjectType } from '../../shared/types'

// ── Default templates ─────────────────────────────────────────────────────────

type Defaults = Record<string, { title: string; subtasks: string[] }[]>

const DEFAULTS: Defaults = {
  website: [
    { title: 'Discovery',    subtasks: ['Client Brief', 'Competitor Analysis', 'Sitemap', 'Technical Requirements'] },
    { title: 'Design',       subtasks: ['Wireframes', 'Visual Concept', 'Mockups', 'Design Review'] },
    { title: 'Content',      subtasks: ['Copywriting', 'Image Selection', 'SEO Copy', 'Content Review'] },
    { title: 'Development',  subtasks: ['Frontend Build', 'CMS Setup', 'Integrations', 'Testing & QA'] },
    { title: 'Launch',       subtasks: ['Final Review', 'Go Live', 'Post-Launch Check', 'Handover Docs'] },
  ],
  branding_guidelines: [
    { title: 'Discovery',    subtasks: ['Brand Audit', 'Competitor Research', 'Brand Brief'] },
    { title: 'Design',       subtasks: ['Logo Concepts', 'Color Palette', 'Typography', 'Brand Elements'] },
    { title: 'Guidelines',   subtasks: ['Brand Manual', 'Usage Examples', 'Asset Export', 'Review'] },
    { title: 'Delivery',     subtasks: ['File Packaging', 'Client Handover'] },
  ],
  logo: [
    { title: 'Discovery',    subtasks: ['Brief', 'Research'] },
    { title: 'Concepts',     subtasks: ['Initial Sketches', 'Digital Concepts', 'Refinement'] },
    { title: 'Delivery',     subtasks: ['Final Files', 'Usage Guide'] },
  ],
  email_marketing: [
    { title: 'Strategy',     subtasks: ['Campaign Brief', 'Audience Segmentation'] },
    { title: 'Design',       subtasks: ['Template Design', 'Copy', 'Asset Prep'] },
    { title: 'Build',        subtasks: ['HTML Build', 'Testing', 'Review'] },
    { title: 'Launch',       subtasks: ['Send', 'Reporting'] },
  ],
  saas: [
    { title: 'Discovery',    subtasks: ['Requirements', 'User Stories', 'Technical Scoping'] },
    { title: 'Design',       subtasks: ['UX Flow', 'UI Design', 'Prototype', 'Design Review'] },
    { title: 'Development',  subtasks: ['Frontend', 'Backend', 'API Integration', 'Testing'] },
    { title: 'QA',           subtasks: ['Bug Testing', 'Performance', 'Security Review'] },
    { title: 'Launch',       subtasks: ['Deployment', 'Documentation', 'Client Training'] },
  ],
}

export function seedDefaultTemplates(orgId: number): void {
  const db = getDb()
  const existing = db
    .prepare('SELECT COUNT(*) as n FROM task_templates WHERE organization_id = ?')
    .get(orgId) as { n: number }
  if (existing.n > 0) return

  const insertTemplate = db.prepare(
    'INSERT INTO task_templates (organization_id, project_type, title, sort_order) VALUES (?, ?, ?, ?)'
  )
  const insertSubtask = db.prepare(
    'INSERT INTO task_template_subtasks (task_template_id, title, sort_order) VALUES (?, ?, ?)'
  )

  const seed = db.transaction(() => {
    for (const [type, tasks] of Object.entries(DEFAULTS)) {
      tasks.forEach((task, ti) => {
        const { lastInsertRowid } = insertTemplate.run(orgId, type, task.title, ti)
        const templateId = Number(lastInsertRowid)
        task.subtasks.forEach((sub, si) => insertSubtask.run(templateId, sub, si))
      })
    }
  })
  seed()
}

// ── Queries ───────────────────────────────────────────────────────────────────

function attachSubtasks(templates: Omit<TaskTemplate, 'subtasks'>[]): TaskTemplate[] {
  const db = getDb()
  return templates.map((t) => ({
    ...t,
    subtasks: db
      .prepare('SELECT * FROM task_template_subtasks WHERE task_template_id = ? ORDER BY sort_order ASC, id ASC')
      .all(t.id) as TaskTemplateSubtask[],
  }))
}

export function getTemplates(orgId: number): TaskTemplate[] {
  const rows = getDb()
    .prepare('SELECT * FROM task_templates WHERE organization_id = ? ORDER BY project_type ASC, sort_order ASC, id ASC')
    .all(orgId) as Omit<TaskTemplate, 'subtasks'>[]
  return attachSubtasks(rows)
}

export function getTemplatesByType(orgId: number, projectType: ProjectType): TaskTemplate[] {
  const rows = getDb()
    .prepare('SELECT * FROM task_templates WHERE organization_id = ? AND project_type = ? ORDER BY sort_order ASC, id ASC')
    .all(orgId, projectType) as Omit<TaskTemplate, 'subtasks'>[]
  return attachSubtasks(rows)
}

// Status → template title hint: when user selects a clock-out status, show subtasks
// from the template that corresponds to the work being handed off.
const STATUS_TEMPLATE_HINTS: Partial<Record<string, string>> = {
  ready_for_design: 'Design',
  ready_for_review: 'Development',
  pm_in_progress:   'Discovery',
}

export function getSubtitlesForTodoByStatus(todoId: number, status: string): string[] {
  const hint = STATUS_TEMPLATE_HINTS[status]
  if (hint) {
    const db = getDb()
    const proj = db
      .prepare('SELECT p.organization_id, p.project_type FROM todos t JOIN projects p ON p.id = t.project_id WHERE t.id = ?')
      .get(todoId) as { organization_id: number; project_type: string } | undefined
    if (proj) {
      const tpl = db
        .prepare('SELECT id FROM task_templates WHERE organization_id = ? AND project_type = ? AND title = ? COLLATE NOCASE LIMIT 1')
        .get(proj.organization_id, proj.project_type, hint) as { id: number } | undefined
      if (tpl) {
        return (db
          .prepare('SELECT title FROM task_template_subtasks WHERE task_template_id = ? ORDER BY sort_order ASC, id ASC')
          .all(tpl.id) as { title: string }[]).map((r) => r.title)
      }
    }
  }
  return getSubtitlesForTodo(todoId)
}

export function getSubtitlesForTodo(todoId: number): string[] {
  const db = getDb()
  const row = db
    .prepare(`
      SELECT t.task_template_id, t.title AS todo_title, p.project_type, p.organization_id
      FROM todos t
      JOIN projects p ON p.id = t.project_id
      WHERE t.id = ?
    `)
    .get(todoId) as { task_template_id: number | null; todo_title: string; project_type: string; organization_id: number } | undefined
  if (!row) return []

  // Use the explicit template link if present
  let templateId = row.task_template_id
  if (!templateId) {
    // Fall back: find a template in this project type whose title matches the task title
    const match = db
      .prepare('SELECT id FROM task_templates WHERE organization_id = ? AND project_type = ? AND title = ? COLLATE NOCASE LIMIT 1')
      .get(row.organization_id, row.project_type, row.todo_title) as { id: number } | undefined
    templateId = match?.id ?? null
  }

  if (!templateId) return []
  return (
    db
      .prepare('SELECT title FROM task_template_subtasks WHERE task_template_id = ? ORDER BY sort_order ASC, id ASC')
      .all(templateId) as { title: string }[]
  ).map((r) => r.title)
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function addSubtask(templateId: number, title: string): TaskTemplateSubtask {
  const db = getDb()
  const maxOrder = (
    db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM task_template_subtasks WHERE task_template_id = ?')
      .get(templateId) as { m: number }
  ).m
  const { lastInsertRowid } = db
    .prepare('INSERT INTO task_template_subtasks (task_template_id, title, sort_order) VALUES (?, ?, ?)')
    .run(templateId, title.trim(), maxOrder + 1)
  return db
    .prepare('SELECT * FROM task_template_subtasks WHERE id = ?')
    .get(Number(lastInsertRowid)) as TaskTemplateSubtask
}

export function removeSubtask(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM task_template_subtasks WHERE id = ?').run(id)
  return changes > 0
}

export function addTemplate(orgId: number, projectType: ProjectType, title: string): TaskTemplate {
  const db = getDb()
  const maxOrder = (
    db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM task_templates WHERE organization_id = ? AND project_type = ?')
      .get(orgId, projectType) as { m: number }
  ).m
  const { lastInsertRowid } = db
    .prepare('INSERT INTO task_templates (organization_id, project_type, title, sort_order) VALUES (?, ?, ?, ?)')
    .run(orgId, projectType, title.trim(), maxOrder + 1)
  return { ...(db.prepare('SELECT * FROM task_templates WHERE id = ?').get(Number(lastInsertRowid)) as Omit<TaskTemplate, 'subtasks'>), subtasks: [] }
}

export function removeTemplate(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM task_templates WHERE id = ?').run(id)
  return changes > 0
}
