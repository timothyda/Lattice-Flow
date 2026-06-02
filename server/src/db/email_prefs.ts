import { getDb } from '.'
import type { ClientContact, NewClientContact, UpdateClientContact, UserEmailPrefs, ProjectClientNotification } from '../shared/types'

// ── Client Contacts ───────────────────────────────────────────────────────────

export function listClientContacts(clientId: number): ClientContact[] {
  return getDb().prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY name ASC').all(clientId) as ClientContact[]
}

export function createClientContact(data: NewClientContact): ClientContact {
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO client_contacts (client_id, name, email, role) VALUES (?, ?, ?, ?)')
    .run(data.client_id, data.name, data.email, data.role ?? null)
  return getDb().prepare('SELECT * FROM client_contacts WHERE id = ?').get(Number(lastInsertRowid)) as ClientContact
}

export function updateClientContact(id: number, data: UpdateClientContact): ClientContact | undefined {
  const fields = Object.keys(data).filter((k) => k in data)
  if (fields.length === 0) return getDb().prepare('SELECT * FROM client_contacts WHERE id = ?').get(id) as ClientContact | undefined
  const sql = `UPDATE client_contacts SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`
  getDb().prepare(sql).run(...fields.map((f) => (data as Record<string, unknown>)[f] ?? null), id)
  return getDb().prepare('SELECT * FROM client_contacts WHERE id = ?').get(id) as ClientContact | undefined
}

export function deleteClientContact(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM client_contacts WHERE id = ?').run(id)
  return changes > 0
}

// ── User Email Prefs ──────────────────────────────────────────────────────────

const PREF_DEFAULTS = { task_assigned: 1, task_complete: 1, status_change: 0, meeting_scheduled: 1 }

export function getUserEmailPrefs(userId: number): UserEmailPrefs {
  const row = getDb().prepare('SELECT * FROM user_email_prefs WHERE user_id = ?').get(userId) as Record<string, number> | undefined
  const r = row ?? { user_id: userId, ...PREF_DEFAULTS }
  return {
    user_id: userId,
    task_assigned:     !!r.task_assigned,
    task_complete:     !!r.task_complete,
    status_change:     !!r.status_change,
    meeting_scheduled: !!r.meeting_scheduled,
  }
}

export function setUserEmailPrefs(userId: number, prefs: Partial<Omit<UserEmailPrefs, 'user_id'>>): UserEmailPrefs {
  getDb().prepare(`
    INSERT INTO user_email_prefs (user_id, task_assigned, task_complete, status_change, meeting_scheduled)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      task_assigned     = excluded.task_assigned,
      task_complete     = excluded.task_complete,
      status_change     = excluded.status_change,
      meeting_scheduled = excluded.meeting_scheduled
  `).run(
    userId,
    prefs.task_assigned     !== undefined ? (prefs.task_assigned ? 1 : 0)     : PREF_DEFAULTS.task_assigned,
    prefs.task_complete     !== undefined ? (prefs.task_complete ? 1 : 0)     : PREF_DEFAULTS.task_complete,
    prefs.status_change     !== undefined ? (prefs.status_change ? 1 : 0)     : PREF_DEFAULTS.status_change,
    prefs.meeting_scheduled !== undefined ? (prefs.meeting_scheduled ? 1 : 0) : PREF_DEFAULTS.meeting_scheduled,
  )
  return getUserEmailPrefs(userId)
}

// ── Project Client Notifications ──────────────────────────────────────────────

export function listProjectClientNotifications(projectId: number): ProjectClientNotification[] {
  return (getDb().prepare(`
    SELECT pcn.*, cc.name as contact_name, cc.email as contact_email
    FROM project_client_notifications pcn
    JOIN client_contacts cc ON pcn.client_contact_id = cc.id
    WHERE pcn.project_id = ?
    ORDER BY cc.name ASC
  `).all(projectId) as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    project_id: r.project_id as number,
    client_contact_id: r.client_contact_id as number,
    contact_name: r.contact_name as string | null,
    contact_email: r.contact_email as string | null,
    status_update: !!r.status_update,
    new_file: !!r.new_file,
    meeting_scheduled: !!r.meeting_scheduled,
  }))
}

export function upsertProjectClientNotification(
  projectId: number,
  clientContactId: number,
  settings: { status_update?: boolean; new_file?: boolean; meeting_scheduled?: boolean }
): void {
  getDb().prepare(`
    INSERT INTO project_client_notifications (project_id, client_contact_id, status_update, new_file, meeting_scheduled)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(project_id, client_contact_id) DO UPDATE SET
      status_update     = excluded.status_update,
      new_file          = excluded.new_file,
      meeting_scheduled = excluded.meeting_scheduled
  `).run(projectId, clientContactId, settings.status_update ? 1 : 0, settings.new_file ? 1 : 0, settings.meeting_scheduled !== false ? 1 : 0)
}

export function removeProjectClientNotification(projectId: number, clientContactId: number): void {
  getDb().prepare('DELETE FROM project_client_notifications WHERE project_id = ? AND client_contact_id = ?').run(projectId, clientContactId)
}

export function getAvailableContactsForProject(projectId: number, clientId: number): ClientContact[] {
  return getDb().prepare(`
    SELECT cc.* FROM client_contacts cc
    WHERE cc.client_id = ?
      AND cc.id NOT IN (SELECT client_contact_id FROM project_client_notifications WHERE project_id = ?)
    ORDER BY cc.name ASC
  `).all(clientId, projectId) as ClientContact[]
}
