import { getDb } from '.'
import type { ArchivedItem } from '../../shared/types'

export function listArchived(organizationId: number): ArchivedItem[] {
  const db = getDb()

  const clients = db.prepare(`
    SELECT 'client' as kind, id, name, NULL as parent_name, archived_at, organization_id
    FROM clients
    WHERE organization_id = ? AND status = 'archived'
    ORDER BY archived_at DESC
  `).all(organizationId) as ArchivedItem[]

  const projects = db.prepare(`
    SELECT 'project' as kind, p.id, p.name, c.name as parent_name, p.archived_at, p.organization_id
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.organization_id = ? AND p.archived_at IS NOT NULL
    ORDER BY p.archived_at DESC
  `).all(organizationId) as ArchivedItem[]

  return [...clients, ...projects].sort(
    (a, b) => (b.archived_at > a.archived_at ? 1 : -1)
  )
}

export function searchArchived(organizationId: number, query: string): ArchivedItem[] {
  const db = getDb()
  const like = `%${query}%`

  const clients = db.prepare(`
    SELECT 'client' as kind, id, name, NULL as parent_name, archived_at, organization_id
    FROM clients
    WHERE organization_id = ? AND status = 'archived' AND name LIKE ?
    ORDER BY archived_at DESC
  `).all(organizationId, like) as ArchivedItem[]

  const projects = db.prepare(`
    SELECT 'project' as kind, p.id, p.name, c.name as parent_name, p.archived_at, p.organization_id
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.organization_id = ? AND p.archived_at IS NOT NULL AND p.name LIKE ?
    ORDER BY p.archived_at DESC
  `).all(organizationId, like) as ArchivedItem[]

  return [...clients, ...projects].sort(
    (a, b) => (b.archived_at > a.archived_at ? 1 : -1)
  )
}
