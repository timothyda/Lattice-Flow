import { getDb } from '.'
import type { Organization, NewOrganization } from '../../shared/types'

export function getOrganization(): Organization | undefined {
  return getDb()
    .prepare('SELECT * FROM organizations LIMIT 1')
    .get() as Organization | undefined
}

export function createOrganization(data: NewOrganization): Organization {
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO organizations (name) VALUES (?)')
    .run(data.name)
  return getDb()
    .prepare('SELECT * FROM organizations WHERE id = ?')
    .get(Number(lastInsertRowid)) as Organization
}

export function updateOrganization(id: number, name: string): Organization | undefined {
  getDb().prepare('UPDATE organizations SET name = ? WHERE id = ?').run(name, id)
  return getDb()
    .prepare('SELECT * FROM organizations WHERE id = ?')
    .get(id) as Organization | undefined
}

export function organizationExists(): boolean {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count FROM organizations')
    .get() as { count: number }
  return row.count > 0
}
