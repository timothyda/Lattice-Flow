import { runOAuthFlow, exchangeCode } from '../oauth'
import { updateOAuthTokens } from '../../db/calendar_accounts'
import { AZURE_CLIENT_ID, AZURE_TENANT_ID } from '../../auth/config'
import type { AccountWithSecrets } from '../../db/calendar_accounts'
import type { CalendarEvent } from '../../../shared/types'

const SCOPES = 'Calendars.Read User.Read offline_access'

export async function connectMicrosoft(): Promise<{
  email: string
  label: string
  accessToken: string
  refreshToken: string
  expiryMs: number
}> {
  if (!AZURE_CLIENT_ID) throw new Error('AZURE_CLIENT_ID is not configured in .env')

  const { code, redirectUri, verifier } = await runOAuthFlow(
    (redirectUri, state, challenge) => {
      const params = new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: SCOPES,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      return `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`
    }
  )

  const tokens = await exchangeCode(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    { client_id: AZURE_CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier, scope: SCOPES }
  )

  const profile = await fetchWithToken<{ displayName: string; mail?: string; userPrincipalName: string }>(
    'https://graph.microsoft.com/v1.0/me', tokens.accessToken
  )

  const email = profile.mail ?? profile.userPrincipalName
  return { email, label: profile.displayName ?? email, ...tokens }
}

async function refreshMicrosoftToken(account: AccountWithSecrets): Promise<string> {
  if (!account.refresh_token) throw new Error('No refresh token stored')
  const tokens = await exchangeCode(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      client_id: AZURE_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
      scope: SCOPES,
    }
  )
  updateOAuthTokens(account.id, tokens.accessToken, tokens.refreshToken || account.refresh_token, tokens.expiresInMs)
  return tokens.accessToken
}

export async function fetchMicrosoftEvents(
  account: AccountWithSecrets,
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  let token = account.access_token
  if (Date.now() > account.token_expiry - 60_000) {
    token = await refreshMicrosoftToken(account)
  }

  const params = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    $top: '100',
    $orderby: 'start/dateTime',
    $select: 'id,subject,bodyPreview,start,end,isAllDay,location,onlineMeeting',
  })

  const data = await fetchWithToken<{
    value: Array<{
      id: string
      subject: string
      bodyPreview?: string
      start: { dateTime: string }
      end: { dateTime: string }
      isAllDay: boolean
      location?: { displayName?: string }
      onlineMeeting?: { joinUrl?: string }
    }>
  }>(`https://graph.microsoft.com/v1.0/me/calendarview?${params}`, token)

  return (data.value ?? []).map((ev) => ({
    id: ev.id,
    title: ev.subject || '(No title)',
    start: ev.start.dateTime,
    end: ev.end.dateTime,
    allDay: ev.isAllDay,
    location: ev.location?.displayName ?? null,
    url: ev.onlineMeeting?.joinUrl ?? null,
    accountId: account.id,
    accountLabel: account.account_label,
    provider: 'microsoft' as const,
    color: account.color,
  }))
}

async function fetchWithToken<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Microsoft API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}
