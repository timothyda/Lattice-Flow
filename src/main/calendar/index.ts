import { getAccountsWithSecretsByUser } from '../db/calendar_accounts'
import { fetchMicrosoftEvents } from './providers/microsoft'
import { fetchGoogleEvents } from './providers/google'
import { fetchZoomMeetings } from './providers/zoom'
import { fetchCalDAVEvents } from './providers/caldav'
import type { CalendarEvent } from '../../shared/types'

export async function fetchAllCalendarEvents(
  userId: number,
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  const accounts = getAccountsWithSecretsByUser(userId)
  const results = await Promise.allSettled(
    accounts.map((account) => {
      switch (account.provider) {
        case 'microsoft':
          return fetchMicrosoftEvents(account, start, end)
        case 'google':
          return fetchGoogleEvents(account, start, end)
        case 'zoom':
          return fetchZoomMeetings(account, start, end)
        case 'caldav':
          return fetchCalDAVEvents(
            account.caldav_url ?? '',
            account.caldav_username ?? '',
            account.caldav_password,
            start, end,
            account.id, account.account_label, account.color
          )
        default:
          return Promise.resolve([])
      }
    })
  )

  const events: CalendarEvent[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') events.push(...result.value)
    // silently skip failed providers — user sees partial results
  }

  return events.sort((a, b) => a.start.localeCompare(b.start))
}
