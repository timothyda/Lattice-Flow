import { runOAuthFlow, exchangeCode } from '../oauth'
import { updateOAuthTokens } from '../../db/calendar_accounts'
import { ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } from '../../auth/config'
import type { AccountWithSecrets } from '../../db/calendar_accounts'
import type { CalendarEvent } from '../../../shared/types'

const TOKEN_URL = 'https://zoom.us/oauth/token'

export async function connectZoom(): Promise<{
  email: string
  label: string
  accessToken: string
  refreshToken: string
  expiryMs: number
}> {
  if (!ZOOM_CLIENT_ID) throw new Error('ZOOM_CLIENT_ID is not configured in .env')

  const { code, redirectUri, verifier } = await runOAuthFlow(
    (redirectUri, state, challenge) => {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: ZOOM_CLIENT_ID,
        redirect_uri: redirectUri,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      return `https://zoom.us/oauth/authorize?${params}`
    }
  )

  const basicAuth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
  const tokens = await exchangeCode(
    TOKEN_URL,
    { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier },
    basicAuth
  )

  const profile = await fetchWithToken<{ email: string; display_name?: string; first_name?: string; last_name?: string }>(
    'https://api.zoom.us/v2/users/me', tokens.accessToken
  )

  const label = profile.display_name ?? (`${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.email)
  return { email: profile.email, label, ...tokens }
}

async function refreshZoomToken(account: AccountWithSecrets): Promise<string> {
  if (!account.refresh_token) throw new Error('No refresh token stored')
  const basicAuth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
  const tokens = await exchangeCode(
    TOKEN_URL,
    { grant_type: 'refresh_token', refresh_token: account.refresh_token },
    basicAuth
  )
  updateOAuthTokens(account.id, tokens.accessToken, tokens.refreshToken || account.refresh_token, tokens.expiresInMs)
  return tokens.accessToken
}

export async function fetchZoomMeetings(
  account: AccountWithSecrets,
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  let token = account.access_token
  if (Date.now() > account.token_expiry - 60_000) {
    token = await refreshZoomToken(account)
  }

  // Zoom accepts YYYY-MM-DD for from/to
  const from = start.slice(0, 10)
  const to = end.slice(0, 10)

  const params = new URLSearchParams({ type: 'scheduled', from, to, page_size: '100' })

  const data = await fetchWithToken<{
    meetings: Array<{
      id: number
      topic: string
      start_time: string
      duration: number
      join_url?: string
    }>
  }>(`https://api.zoom.us/v2/users/me/meetings?${params}`, token)

  return (data.meetings ?? []).map((m) => {
    const startDate = new Date(m.start_time)
    const endDate = new Date(startDate.getTime() + m.duration * 60_000)
    return {
      id: String(m.id),
      title: m.topic || '(No title)',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: false,
      location: null,
      url: m.join_url ?? null,
      accountId: account.id,
      accountLabel: account.account_label,
      provider: 'zoom' as const,
      color: account.color,
    }
  })
}

async function fetchWithToken<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Zoom API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}
