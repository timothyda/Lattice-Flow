import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import type { User, AuthUser, Organization } from './shared/types'
import {
  getUserById, getUserByEmail, createUser,
  getAuthRow, setPasswordHash,
  consumeInviteToken,
  isUserLocked, incrementFailedAttempts, lockUser, recordSuccessfulLogin,
  isLegacyMsalUser, setRecoveryCodeHash, getRecoveryCodeHash,
  generateInviteToken as dbGenerateInviteToken,
} from './db/users'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
const SESSION_TTL_SECONDS = 14 * 60 * 60
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

export interface TokenPayload {
  userId: number
  orgId: number
  role: string
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

function buildResponse(user: User): { token: string; authUser: AuthUser; user: User } {
  const token = signToken({ userId: user.id, orgId: user.organization_id!, role: user.role })
  return { token, authUser: { name: user.display_name, email: user.email }, user }
}

async function makeRecoveryCode(userId: number): Promise<string> {
  const raw = crypto.randomBytes(12).toString('hex').toUpperCase()
  const code = `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}-${raw.slice(18, 24)}`
  const hash = await bcrypt.hash(code, 10)
  setRecoveryCodeHash(userId, hash)
  return code
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: true; token: string; authUser: AuthUser; user: User } | { ok: false; error: string; migrate?: true }> {
  const user = getUserByEmail(email)
  if (!user) return { ok: false, error: 'Invalid email or password.' }

  if (isUserLocked(user.id)) return { ok: false, error: 'Account temporarily locked. Try again in 15 minutes.' }

  const authRow = getAuthRow(user.id)

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
      lockUser(user.id, new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString())
      return { ok: false, error: 'Too many failed attempts. Account locked for 15 minutes.' }
    }
    return { ok: false, error: 'Invalid email or password.' }
  }

  recordSuccessfulLogin(user.id)
  return { ok: true, ...buildResponse(getUserById(user.id) ?? user) }
}

export async function setupOrg(
  orgName: string, adminName: string, email: string, password: string
): Promise<{ ok: true; token: string; org: Organization; user: User; authUser: AuthUser; recoveryCode: string } | { ok: false; error: string }> {
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }

  const { createOrganization } = await import('./db/organizations')
  const { seedDefaultTemplates } = await import('./db/task_templates')
  const { seedDefaultRouting } = await import('./db/role_routing')

  const org = createOrganization({ name: orgName })
  seedDefaultTemplates(org.id)
  seedDefaultRouting(org.id)

  const newUser = createUser({ organization_id: org.id, display_name: adminName, email, role: 'admin', must_set_password: 0 })
  setPasswordHash(newUser.id, await bcrypt.hash(password, 12))
  const recoveryCode = await makeRecoveryCode(newUser.id)
  recordSuccessfulLogin(newUser.id)
  const fresh = getUserById(newUser.id) ?? newUser

  return { ok: true, org, recoveryCode, ...buildResponse(fresh) }
}

export async function activateAccount(
  email: string, inviteToken: string, newPassword: string
): Promise<{ ok: true; token: string; authUser: AuthUser; user: User } | { ok: false; error: string }> {
  if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
  const user = consumeInviteToken(email, inviteToken)
  if (!user) return { ok: false, error: 'Invalid or expired invite code.' }
  setPasswordHash(user.id, await bcrypt.hash(newPassword, 12))
  recordSuccessfulLogin(user.id)
  return { ok: true, ...buildResponse(getUserById(user.id) ?? user) }
}

export async function migrateFromMsal(
  email: string, newPassword: string
): Promise<{ ok: true; token: string; authUser: AuthUser; user: User; recoveryCode: string } | { ok: false; error: string }> {
  if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
  const user = getUserByEmail(email)
  if (!user) return { ok: false, error: 'No account found for that email.' }
  if (getAuthRow(user.id)?.password_hash) return { ok: false, error: 'This account already has a password. Use the sign-in form.' }
  if (!isLegacyMsalUser(user.id)) return { ok: false, error: 'This account requires an invite code to activate.' }
  setPasswordHash(user.id, await bcrypt.hash(newPassword, 12))
  const recoveryCode = await makeRecoveryCode(user.id)
  recordSuccessfulLogin(user.id)
  return { ok: true, recoveryCode, ...buildResponse(getUserById(user.id) ?? user) }
}

export async function resetWithRecoveryCode(
  email: string, code: string, newPassword: string
): Promise<{ ok: true; token: string; authUser: AuthUser; user: User } | { ok: false; error: string }> {
  if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
  const user = getUserByEmail(email)
  if (!user) return { ok: false, error: 'No account found for that email.' }
  const storedHash = getRecoveryCodeHash(user.id)
  if (!storedHash) return { ok: false, error: 'No recovery code has been set for this account.' }
  if (!await bcrypt.compare(code.toUpperCase().replace(/\s/g, ''), storedHash)) return { ok: false, error: 'Invalid recovery code.' }
  setPasswordHash(user.id, await bcrypt.hash(newPassword, 12))
  recordSuccessfulLogin(user.id)
  return { ok: true, ...buildResponse(getUserById(user.id) ?? user) }
}

export async function generateRecoveryCode(userId: number): Promise<string> {
  return makeRecoveryCode(userId)
}

export function generateInvite(userId: number): string {
  return dbGenerateInviteToken(userId)
}

export function refreshToken(payload: TokenPayload): string {
  return signToken(payload)
}
