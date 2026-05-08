import { getDb } from './index'
import { encryptSecret, decryptSecret } from '../calendar/encryption'
import type { CalendarAccount, CalendarProvider } from '../../shared/types'

interface AccountRow {
  id: number
  user_id: number
  provider: string
  account_label: string
  account_email: string | null
  access_token: string | null
  refresh_token: string | null
  token_expiry: number | null
  caldav_url: string | null
  caldav_username: string | null
  caldav_password: string | null
  color: string
}

export interface AccountWithSecrets extends CalendarAccount {
  access_token: string
  refresh_token: string
  token_expiry: number
  caldav_username: string | null
  caldav_password: string
}

export function getAccountsByUser(userId: number): CalendarAccount[] {
  return getDb()
    .prepare(`
      SELECT id, user_id, provider, account_label, account_email, color, caldav_url
      FROM calendar_accounts WHERE user_id = ? ORDER BY created_at ASC
    `)
    .all(userId) as CalendarAccount[]
}

export function getAccountWithSecrets(id: number): AccountWithSecrets | null {
  const row = getDb()
    .prepare('SELECT * FROM calendar_accounts WHERE id = ?')
    .get(id) as AccountRow | undefined
  if (!row) return null
  return {
    id: row.id,
    user_id: row.user_id,
    provider: row.provider as CalendarProvider,
    account_label: row.account_label,
    account_email: row.account_email,
    color: row.color,
    caldav_url: row.caldav_url,
    access_token: row.access_token ? decryptSecret(row.access_token) : '',
    refresh_token: row.refresh_token ? decryptSecret(row.refresh_token) : '',
    token_expiry: row.token_expiry ?? 0,
    caldav_username: row.caldav_username,
    caldav_password: row.caldav_password ? decryptSecret(row.caldav_password) : '',
  }
}

export function getAccountsWithSecretsByUser(userId: number): AccountWithSecrets[] {
  const ids = getDb()
    .prepare('SELECT id FROM calendar_accounts WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId) as { id: number }[]
  return ids.map((r) => getAccountWithSecrets(r.id)).filter(Boolean) as AccountWithSecrets[]
}

export function createOAuthAccount(
  userId: number,
  provider: CalendarProvider,
  label: string,
  email: string | null,
  accessToken: string,
  refreshToken: string,
  expiryMs: number,
  color: string
): CalendarAccount {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO calendar_accounts
      (user_id, provider, account_label, account_email, access_token, refresh_token, token_expiry, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, provider, label, email, encryptSecret(accessToken), encryptSecret(refreshToken), expiryMs, color)

  return getAccountsByUser(userId).find((a) => a.id === (result.lastInsertRowid as number))!
}

export function createCalDAVAccount(
  userId: number,
  url: string,
  username: string,
  password: string,
  label: string,
  color: string
): CalendarAccount {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO calendar_accounts
      (user_id, provider, account_label, caldav_url, caldav_username, caldav_password, color)
    VALUES (?, 'caldav', ?, ?, ?, ?, ?)
  `).run(userId, label, url, username, encryptSecret(password), color)

  return getAccountsByUser(userId).find((a) => a.id === (result.lastInsertRowid as number))!
}

export function updateOAuthTokens(
  id: number,
  accessToken: string,
  refreshToken: string,
  expiryMs: number
): void {
  getDb().prepare(
    'UPDATE calendar_accounts SET access_token = ?, refresh_token = ?, token_expiry = ? WHERE id = ?'
  ).run(encryptSecret(accessToken), encryptSecret(refreshToken), expiryMs, id)
}

export function deleteCalendarAccount(id: number): boolean {
  return getDb().prepare('DELETE FROM calendar_accounts WHERE id = ?').run(id).changes > 0
}

const COLOR_PALETTE = [
  '#0078D4', '#34A853', '#2D8CFF', '#8B5CF6',
  '#F59E0B', '#EF4444', '#06B6D4', '#EC4899',
  '#10B981', '#F97316', '#6366F1', '#14B8A6',
]

export function nextAccountColor(userId: number): string {
  const row = getDb()
    .prepare('SELECT COUNT(*) as n FROM calendar_accounts WHERE user_id = ?')
    .get(userId) as { n: number }
  return COLOR_PALETTE[row.n % COLOR_PALETTE.length]
}
