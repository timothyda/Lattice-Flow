import crypto from 'crypto'
import { getDb } from '.'
import type { User, UserRole } from '../../shared/types'
import { DEFAULT_WIDGETS as DW } from '../../shared/types'

function defaultWidgets(role: UserRole): string {
  return JSON.stringify(DW[role])
}

function getDefaultOrgId(): number | null {
  const row = getDb().prepare('SELECT id FROM organizations LIMIT 1').get() as { id: number } | undefined
  return row?.id ?? null
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function getUserById(id: number): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
}

export function getUserByEmail(email: string): User | undefined {
  return getDb()
    .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
    .get(email) as User | undefined
}

export function listUsers(organizationId?: number): User[] {
  if (organizationId !== undefined) {
    return getDb()
      .prepare('SELECT * FROM users WHERE organization_id = ? ORDER BY display_name ASC')
      .all(organizationId) as User[]
  }
  return getDb().prepare('SELECT * FROM users ORDER BY display_name ASC').all() as User[]
}

// ── Auth-sensitive data (never sent to renderer) ──────────────────────────────

interface AuthRow {
  id: number
  password_hash: string | null
  invite_token: string | null
  invite_expires: string | null
  must_set_password: number
  failed_attempts: number
  locked_until: string | null
}

export function getAuthRow(userId: number): AuthRow | undefined {
  return getDb().prepare(`
    SELECT id, password_hash, invite_token, invite_expires,
           must_set_password, failed_attempts, locked_until
    FROM users WHERE id = ?
  `).get(userId) as AuthRow | undefined
}

// ── Create ────────────────────────────────────────────────────────────────────

export function createUser(data: {
  organization_id?: number
  display_name: string
  email: string
  role?: UserRole
  must_set_password?: number
}): User {
  const db = getDb()
  const orgId = data.organization_id ?? getDefaultOrgId()
  const role: UserRole = data.role ?? 'designer'
  const widgets = defaultWidgets(role)
  const mustSet = data.must_set_password ?? 1
  const msUserId = `local:${data.email.toLowerCase()}`

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO users (organization_id, ms_user_id, display_name, email, avatar_url, role, dashboard_widgets, must_set_password)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
  `).run(orgId, msUserId, data.display_name, data.email.toLowerCase(), role, widgets, mustSet)

  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(lastInsertRowid)) as User
}

// ── Update ────────────────────────────────────────────────────────────────────

export function updateUser(id: number, data: Partial<Pick<User, 'role' | 'dashboard_widgets'>>): User | undefined {
  const fields: string[] = []
  const values: unknown[] = []
  if ('role' in data && data.role) { fields.push('role = ?'); values.push(data.role) }
  if ('dashboard_widgets' in data && data.dashboard_widgets !== undefined) {
    fields.push('dashboard_widgets = ?'); values.push(data.dashboard_widgets)
  }
  if (fields.length === 0) return getUserById(id)
  values.push(id)
  getDb().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return getUserById(id)
}

export function deleteUser(id: number): boolean {
  const { changes } = getDb().prepare('DELETE FROM users WHERE id = ?').run(id)
  return changes > 0
}

// ── Password management ───────────────────────────────────────────────────────

export function setPasswordHash(userId: number, hash: string): void {
  getDb().prepare(`
    UPDATE users SET password_hash = ?, must_set_password = 0 WHERE id = ?
  `).run(hash, userId)
}

export function generateInviteToken(userId: number): string {
  const token = crypto.randomBytes(16).toString('hex')
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  getDb().prepare(`
    UPDATE users SET invite_token = ?, invite_expires = ?, must_set_password = 1 WHERE id = ?
  `).run(token, expires, userId)
  return token
}

// Verifies token, clears it, and returns the user if valid.
export function consumeInviteToken(email: string, token: string): User | undefined {
  const db = getDb()
  const user = db.prepare(`
    SELECT * FROM users
    WHERE lower(email) = lower(?)
      AND invite_token = ?
      AND invite_expires > datetime('now')
  `).get(email, token) as User | undefined

  if (!user) return undefined
  db.prepare(`UPDATE users SET invite_token = NULL, invite_expires = NULL WHERE id = ?`).run(user.id)
  return user
}

// ── Login tracking / lockout ──────────────────────────────────────────────────

export function isUserLocked(userId: number): boolean {
  const row = getDb().prepare('SELECT locked_until FROM users WHERE id = ?').get(userId) as { locked_until: string | null } | undefined
  if (!row?.locked_until) return false
  return new Date(row.locked_until) > new Date()
}

export function incrementFailedAttempts(userId: number): number {
  const db = getDb()
  db.prepare('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?').run(userId)
  const row = db.prepare('SELECT failed_attempts FROM users WHERE id = ?').get(userId) as { failed_attempts: number }
  return row?.failed_attempts ?? 0
}

export function lockUser(userId: number, until: string): void {
  getDb().prepare('UPDATE users SET locked_until = ? WHERE id = ?').run(until, userId)
}

export function recordSuccessfulLogin(userId: number): void {
  getDb().prepare(`
    UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = datetime('now') WHERE id = ?
  `).run(userId)
}

// ── Recovery code ─────────────────────────────────────────────────────────────

export function setRecoveryCodeHash(userId: number, hash: string): void {
  getDb().prepare('UPDATE users SET recovery_code_hash = ? WHERE id = ?').run(hash, userId)
}

export function getRecoveryCodeHash(userId: number): string | null {
  const row = getDb().prepare('SELECT recovery_code_hash FROM users WHERE id = ?').get(userId) as { recovery_code_hash: string | null } | undefined
  return row?.recovery_code_hash ?? null
}

// True if this account was originally created via Microsoft MSAL (not the new in-app flow).
export function isLegacyMsalUser(userId: number): boolean {
  const row = getDb().prepare('SELECT ms_user_id FROM users WHERE id = ?').get(userId) as { ms_user_id: string } | undefined
  return !!row && !row.ms_user_id.startsWith('local:')
}
