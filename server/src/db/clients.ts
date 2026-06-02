import { getDb } from '.'
import type { Client, NewClient, UpdateClient } from '../shared/types'

const UPDATABLE: (keyof UpdateClient)[] = ['name', 'contact_name', 'contact_email', 'contact_role', 'notes', 'description', 'logo_url']

export function listClients(organizationId: number): Client[] {
  return getDb()
    .prepare("SELECT * FROM clients WHERE organization_id = ? AND (status IS NULL OR status != 'archived') ORDER BY name ASC")
    .all(organizationId) as Client[]
}

export function getClient(id: number): Client | undefined {
  return getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client | undefined
}

export function createClient(data: NewClient): Client {
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO clients (organization_id, name, contact_name, contact_email, contact_role, notes, description, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(data.organization_id, data.name, data.contact_name ?? null, data.contact_email ?? null, data.contact_role ?? null, data.notes ?? null, data.description ?? null, data.logo_url ?? null)
  return getClient(Number(lastInsertRowid))!
}

export function updateClient(id: number, data: UpdateClient): Client | undefined {
  const cols = UPDATABLE.filter((k) => k in data)
  if (cols.length === 0) return getClient(id)
  const sql = `UPDATE clients SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
  getDb().prepare(sql).run(...cols.map((c) => data[c] ?? null), id)
  return getClient(id)
}

export function archiveClient(id: number): boolean {
  const { changes } = getDb()
    .prepare("UPDATE clients SET status = 'archived', archived_at = datetime('now') WHERE id = ?")
    .run(id)
  return changes > 0
}

export function restoreClient(id: number): boolean {
  const { changes } = getDb()
    .prepare("UPDATE clients SET status = 'active', archived_at = NULL WHERE id = ?")
    .run(id)
  return changes > 0
}

export function deleteClient(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM clients WHERE id = ?').run(id)
  return changes > 0
}
