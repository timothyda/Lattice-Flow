import { runOAuthFlow, exchangeCode } from '../oauth'
import { updateOAuthTokens } from '../../db/calendar_accounts'
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../../auth/config'
import type { AccountWithSecrets } from '../../db/calendar_accounts'
import type { CalendarEvent } from '../../../shared/types'

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly email profile'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function connectGoogle(): Promise<{
  email: string
  label: string
  accessToken: string
  refreshToken: string
  expiryMs: number
}> {
  if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not configured in .env')

  const { code, redirectUri, verifier } = await runOAuthFlow(
    (redirectUri, state, challenge) => {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
      })
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    }
  )

  const tokens = await exchangeCode(TOKEN_URL, {
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  })

  const profile = await fetchWithToken<{ email: string; name: string }>(
    'https://www.googleapis.com/oauth2/v2/userinfo', tokens.accessToken
  )

  return { email: profile.email, label: profile.name ?? profile.email, ...tokens }
}

async function refreshGoogleToken(account: AccountWithSecrets): Promise<string> {
  if (!account.refresh_token) throw new Error('No refresh token stored')
  const tokens = await exchangeCode(TOKEN_URL, {
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
  })
  updateOAuthTokens(account.id, tokens.accessToken, account.refresh_token, tokens.expiresInMs)
  return tokens.accessToken
}

export async function fetchGoogleEvents(
  account: AccountWithSecrets,
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  let token = account.access_token
  if (Date.now() > account.token_expiry - 60_000) {
    token = await refreshGoogleToken(account)
  }

  const params = new URLSearchParams({
    timeMin: start,
    timeMax: end,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    fields: 'items(id,summary,description,start,end,location,hangoutLink)',
  })

  const data = await fetchWithToken<{
    items: Array<{
      id: string
      summary?: string
      description?: string
      start: { dateTime?: string; date?: string }
      end: { dateTime?: string; date?: string }
      location?: string
      hangoutLink?: string
    }>
  }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, token)

  return (data.items ?? []).map((ev) => {
    const allDay = !ev.start.dateTime
    const start = ev.start.dateTime ?? `${ev.start.date}T00:00:00`
    const end = ev.end.dateTime ?? `${ev.end.date}T00:00:00`
    return {
      id: ev.id,
      title: ev.summary || '(No title)',
      start,
      end,
      allDay,
      location: ev.location ?? null,
      url: ev.hangoutLink ?? null,
      accountId: account.id,
      accountLabel: account.account_label,
      provider: 'google' as const,
      color: account.color,
    }
  })
}

async function fetchWithToken<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Google API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}
