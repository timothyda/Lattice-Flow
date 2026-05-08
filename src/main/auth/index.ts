import { safeStorage, app } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import type { User, AuthUser, Organization } from '../../shared/types'
import {
  getUserById, getUserByEmail, createUser,
  getAuthRow, setPasswordHash,
  generateInviteToken, consumeInviteToken,
  isUserLocked, incrementFailedAttempts, lockUser, recordSuccessfulLogin,
  isLegacyMsalUser, setRecoveryCodeHash, getRecoveryCodeHash
} from '../db/users'

const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

let _cachedUser: User | null = null

function sessionFilePath(): string {
  return join(app.getPath('userData'), 'session.enc')
}

function saveSession(userId: number): void {
  const payload = JSON.stringify({
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  })
  try {
    const encrypted = safeStorage.encryptString(payload)
    writeFileSync(sessionFilePath(), encrypted)
  } catch (err) {
    console.error('[auth] failed to save session:', err)
  }
}

function readSession(): number | null {
  try {
    if (!existsSync(sessionFilePath())) return null
    const encrypted = readFileSync(sessionFilePath())
    const payload = JSON.parse(safeStorage.decryptString(encrypted))
    if (!payload.expiresAt || new Date(payload.expiresAt) < new Date()) {
      clearSessionFile()
      return null
    }
    return payload.userId as number
  } catch {
    clearSessionFile()
    return null
  }
}

function clearSessionFile(): void {
  try { unlinkSync(sessionFilePath()) } catch {}
}

// Generates a readable recovery code and stores its bcrypt hash.
async function makeRecoveryCode(userId: number): Promise<string> {
  const raw = crypto.randomBytes(12).toString('hex').toUpperCase()
  // Display as XXXXXX-XXXXXX-XXXXXX-XXXXXX
  const code = `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}-${raw.slice(18, 24)}`
  const hash = await bcrypt.hash(code, 10)
  setRecoveryCodeHash(userId, hash)
  return code
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getAuthStatus(): AuthUser | null {
  if (_cachedUser) return { name: _cachedUser.display_name, email: _cachedUser.email }
  const userId = readSession()
  if (!userId) return null
  const user = getUserById(userId)
  if (!user) { clearSessionFile(); return null }
  _cachedUser = user
  return { name: user.display_name, email: user.email }
}

export function getCurrentUser(): User | null {
  if (_cachedUser) return _cachedUser
  const userId = readSession()
  if (!userId) return null
  const user = getUserById(userId)
  if (!user) { clearSessionFile(); return null }
  _cachedUser = user
  return _cachedUser
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string; migrate?: true }> {
  const user = getUserByEmail(email)
  if (!user) return { ok: false, error: 'Invalid email or password.' }

  if (isUserLocked(user.id)) {
    return { ok: false, error: 'Account temporarily locked. Try again in 15 minutes.' }
  }

  const authRow = getAuthRow(user.id)

  // MSAL migration: account exists but has never had a password set.
  if (!authRow?.password_hash && isLegacyMsalUser(user.id)) {
    return { ok: false, error: 'Your account needs a password. Please set one to continue.', migrate: true }
  }

  if (!authRow?.password_hash) {
    return { ok: false, error: 'Account not yet activated. Use your invite code to set a password.' }
  }

  const valid = await bcrypt.compare(password, authRow.password_hash)
  if (!valid) {
    const attempts = incrementFailedAttempts(user.id)
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      lockUser(user.id, until)
      return { ok: false, error: 'Too many failed attempts. Account locked for 15 minutes.' }
    }
    return { ok: false, error: 'Invalid email or password.' }
  }

  recordSuccessfulLogin(user.id)
  saveSession(user.id)
  _cachedUser = getUserById(user.id) ?? user

  return { ok: true, authUser: { name: user.display_name, email: user.email }, user: _cachedUser }
}

// For MSAL-migrated users: set a password without requiring an invite code.
// Only valid when the account has no password_hash yet.
export async function migrateFromMsal(
  email: string,
  newPassword: string
): Promise<{ ok: true; authUser: AuthUser; user: User; recoveryCode: string } | { ok: false; error: string }> {
  if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }

  const user = getUserByEmail(email)
  if (!user) return { ok: false, error: 'No account found for that email.' }

  const authRow = getAuthRow(user.id)
  if (authRow?.password_hash) {
    return { ok: false, error: 'This account already has a password. Use the sign-in form.' }
  }
  if (!isLegacyMsalUser(user.id)) {
    return { ok: false, error: 'This account requires an invite code to activate.' }
  }

  const hash = await bcrypt.hash(newPassword, 12)
  setPasswordHash(user.id, hash)
  const recoveryCode = await makeRecoveryCode(user.id)
  recordSuccessfulLogin(user.id)
  saveSession(user.id)
  _cachedUser = getUserById(user.id) ?? user

  return { ok: true, authUser: { name: user.display_name, email: user.email }, user: _cachedUser, recoveryCode }
}

export async function activateAccount(
  email: string,
  inviteToken: string,
  newPassword: string
): Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }

  const user = consumeInviteToken(email, inviteToken)
  if (!user) return { ok: false, error: 'Invalid or expired invite code.' }

  const hash = await bcrypt.hash(newPassword, 12)
  setPasswordHash(user.id, hash)
  recordSuccessfulLogin(user.id)
  saveSession(user.id)
  _cachedUser = getUserById(user.id) ?? user

  return { ok: true, authUser: { name: user.display_name, email: user.email }, user: _cachedUser }
}

// Reset password using a saved recovery code. Does NOT consume the code.
export async function resetWithRecoveryCode(
  email: string,
  code: string,
  newPassword: string
): Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string }> {
  if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }

  const user = getUserByEmail(email)
  if (!user) return { ok: false, error: 'No account found for that email.' }

  const storedHash = getRecoveryCodeHash(user.id)
  if (!storedHash) return { ok: false, error: 'No recovery code has been set for this account.' }

  const valid = await bcrypt.compare(code.toUpperCase().replace(/\s/g, ''), storedHash)
  if (!valid) return { ok: false, error: 'Invalid recovery code.' }

  const hash = await bcrypt.hash(newPassword, 12)
  setPasswordHash(user.id, hash)
  recordSuccessfulLogin(user.id)
  saveSession(user.id)
  _cachedUser = getUserById(user.id) ?? user

  return { ok: true, authUser: { name: user.display_name, email: user.email }, user: _cachedUser }
}

export async function setupOrg(
  orgName: string,
  adminName: string,
  email: string,
  password: string
): Promise<{ ok: true; org: Organization; user: User; authUser: AuthUser; recoveryCode: string } | { ok: false; error: string }> {
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }

  const { createOrganization } = await import('../db/organizations')
  const { seedDefaultTemplates } = await import('../db/task_templates')
  const { seedDefaultRouting } = await import('../db/role_routing')
  const org = createOrganization({ name: orgName })
  seedDefaultTemplates(org.id)
  seedDefaultRouting(org.id)

  const newUser = createUser({
    organization_id: org.id,
    display_name: adminName,
    email,
    role: 'admin',
    must_set_password: 0
  })

  const hash = await bcrypt.hash(password, 12)
  setPasswordHash(newUser.id, hash)
  const recoveryCode = await makeRecoveryCode(newUser.id)
  recordSuccessfulLogin(newUser.id)
  saveSession(newUser.id)
  _cachedUser = getUserById(newUser.id) ?? newUser

  return {
    ok: true,
    org,
    user: _cachedUser,
    authUser: { name: adminName, email: email.toLowerCase() },
    recoveryCode
  }
}

export function logout(): void {
  _cachedUser = null
  clearSessionFile()
}

export function generateInvite(userId: number): string {
  return generateInviteToken(userId)
}

// Generate a new recovery code for the currently signed-in user.
export async function generateRecoveryCode(): Promise<string | null> {
  const user = getCurrentUser()
  if (!user) return null
  return makeRecoveryCode(user.id)
}
