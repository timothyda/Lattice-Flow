import { apiClient } from '../api-client'
import { getJwt, setJwt, clearJwt } from '../connection-store'
import { emitConnectionState } from '../ws-client'
import type { User, AuthUser, Organization } from '../../shared/types'

let _cachedUser: User | null = null

// ── Public read API ───────────────────────────────────────────────────────────

export function getAuthStatus(): AuthUser | null {
  if (!getJwt()) return null
  if (_cachedUser) return { name: _cachedUser.display_name, email: _cachedUser.email }
  return null
}

export function getCurrentUser(): User | null {
  return _cachedUser
}

/** Called on app startup to restore session from saved JWT. */
export async function restoreSession(): Promise<User | null> {
  if (!getJwt()) return null
  try {
    const user = await apiClient.get<User>('/users/me')
    _cachedUser = user
    return user
  } catch {
    return null
  }
}

// ── Auth operations (all delegate to server) ──────────────────────────────────

export async function login(
  email: string,
  password: string
): Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string; migrate?: true }> {
  const result = await apiClient.post<
    { ok: true; token: string; authUser: AuthUser; user: User } |
    { ok: false; error: string; migrate?: true }
  >('/auth/login', { email, password })

  if (result.ok) {
    setJwt(result.token)
    _cachedUser = result.user
    const { token: _, ...rest } = result
    return rest
  }
  return result
}

export async function setupOrg(
  orgName: string, adminName: string, email: string, password: string
): Promise<{ ok: true; org: Organization; user: User; authUser: AuthUser; recoveryCode: string } | { ok: false; error: string }> {
  const result = await apiClient.post<
    { ok: true; token: string; org: Organization; user: User; authUser: AuthUser; recoveryCode: string } |
    { ok: false; error: string }
  >('/auth/setup', { orgName, adminName, email, password })

  if (result.ok) {
    setJwt(result.token)
    _cachedUser = result.user
    const { token: _, ...rest } = result
    return rest
  }
  return result
}

export async function activateAccount(
  email: string, inviteToken: string, newPassword: string
): Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string }> {
  const result = await apiClient.post<
    { ok: true; token: string; authUser: AuthUser; user: User } | { ok: false; error: string }
  >('/auth/activate', { email, inviteToken, newPassword })

  if (result.ok) {
    setJwt(result.token)
    _cachedUser = result.user
    const { token: _, ...rest } = result
    return rest
  }
  return result
}

export async function migrateFromMsal(
  email: string, newPassword: string
): Promise<{ ok: true; authUser: AuthUser; user: User; recoveryCode: string } | { ok: false; error: string }> {
  const result = await apiClient.post<
    { ok: true; token: string; authUser: AuthUser; user: User; recoveryCode: string } | { ok: false; error: string }
  >('/auth/migrate-msal', { email, newPassword })

  if (result.ok) {
    setJwt(result.token)
    _cachedUser = result.user
    const { token: _, ...rest } = result
    return rest
  }
  return result
}

export async function resetWithRecoveryCode(
  email: string, code: string, newPassword: string
): Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string }> {
  const result = await apiClient.post<
    { ok: true; token: string; authUser: AuthUser; user: User } | { ok: false; error: string }
  >('/auth/recover', { email, code, newPassword })

  if (result.ok) {
    setJwt(result.token)
    _cachedUser = result.user
    const { token: _, ...rest } = result
    return rest
  }
  return result
}

export function logout(): void {
  _cachedUser = null
  clearJwt()
  emitConnectionState('auth_expired')
}

export function generateInvite(userId: number): Promise<string> {
  return apiClient.post<{ token: string }>(`/auth/invite/${userId}`).then((r) => r.token)
}

export async function generateRecoveryCode(): Promise<string | null> {
  try {
    const r = await apiClient.post<{ code: string }>('/auth/recovery-code')
    return r.code
  } catch { return null }
}
