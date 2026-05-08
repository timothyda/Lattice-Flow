import { getDb } from '.'
import type { Phase, NewPhase, UpdatePhase, PhaseDateHistory } from '../../shared/types'

export function listPhases(projectId: number): Phase[] {
  return getDb()
    .prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY "order" ASC')
    .all(projectId) as Phase[]
}

export function getPhase(id: number): Phase | undefined {
  return getDb()
    .prepare('SELECT * FROM phases WHERE id = ?')
    .get(id) as Phase | undefined
}

export function createPhase(data: NewPhase): Phase {
  const { lastInsertRowid } = getDb()
    .prepare(`
      INSERT INTO phases (project_id, name, "order", description, planned_start, planned_end, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      data.project_id,
      data.name,
      data.order,
      data.description ?? '',
      data.planned_start ?? null,
      data.planned_end ?? null,
      data.status ?? 'planning'
    )
  return getPhase(Number(lastInsertRowid))!
}

export function updatePhase(id: number, data: UpdatePhase): Phase | undefined {
  const current = getPhase(id)
  if (!current) return undefined

  const updates: string[] = []
  const values: unknown[] = []

  if ('name' in data)          { updates.push('name = ?');          values.push(data.name) }
  if ('order' in data)         { updates.push('"order" = ?');       values.push(data.order) }
  if ('description' in data)   { updates.push('description = ?');   values.push(data.description) }
  if ('planned_start' in data) { updates.push('planned_start = ?'); values.push(data.planned_start ?? null) }
  if ('planned_end' in data)   { updates.push('planned_end = ?');   values.push(data.planned_end ?? null) }
  if ('status' in data)        { updates.push('status = ?');        values.push(data.status) }

  if (updates.length === 0) return current

  const dateChanged =
    ('planned_start' in data && data.planned_start !== current.planned_start) ||
    ('planned_end' in data && data.planned_end !== current.planned_end)

  if (dateChanged) {
    getDb()
      .prepare(`
        INSERT INTO phase_date_history (phase_id, old_start, old_end, new_start, new_end)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        id,
        current.planned_start,
        current.planned_end,
        'planned_start' in data ? (data.planned_start ?? null) : current.planned_start,
        'planned_end' in data   ? (data.planned_end   ?? null) : current.planned_end
      )
  }

  getDb()
    .prepare(`UPDATE phases SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values, id)

  return getPhase(id)
}

export function deletePhase(id: number): boolean {
  const { changes } = getDb()
    .prepare('DELETE FROM phases WHERE id = ?')
    .run(id)
  return changes > 0
}

export function listPhaseHistory(phaseId: number): PhaseDateHistory[] {
  return getDb()
    .prepare('SELECT * FROM phase_date_history WHERE phase_id = ? ORDER BY changed_at ASC')
    .all(phaseId) as PhaseDateHistory[]
}
