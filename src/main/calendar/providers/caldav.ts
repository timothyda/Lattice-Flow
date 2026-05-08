import type { CalendarEvent } from '../../../shared/types'

// ── ical / VEVENT parsing ─────────────────────────────────────────────────────

function unfold(text: string): string {
  return text.replace(/\r?\n[ \t]/g, '')
}

function getProp(block: string, key: string): string | null {
  // Matches KEY:value and KEY;PARAM=...:value
  const match = block.match(new RegExp(`^${key}(?:;[^:\\r\\n]*)?:([^\\r\\n]*)`, 'm'))
  return match ? match[1].trim() : null
}

function parseIcalDatetime(raw: string): string {
  // Strip any parameters before the colon (e.g. TZID=America/New_York:20240101T100000)
  const value = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw.trim()

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`
  }
  if (/^\d{8}T\d{6}(Z?)$/.test(value)) {
    const v = value.replace('Z', '')
    const iso = `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}`
    return value.endsWith('Z') ? `${iso}Z` : iso
  }
  return value
}

function parseVEvents(
  icalText: string,
  accountId: number,
  accountLabel: string,
  color: string
): CalendarEvent[] {
  const unfolded = unfold(icalText)
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []
  const events: CalendarEvent[] = []

  for (const block of blocks) {
    const uid = getProp(block, 'UID')
    const summary = getProp(block, 'SUMMARY') ?? '(No title)'
    const dtstart = getProp(block, 'DTSTART') ?? ''
    const dtend = getProp(block, 'DTEND') ?? dtstart
    const location = getProp(block, 'LOCATION')
    const url = getProp(block, 'URL')

    if (!uid || !dtstart) continue

    const rawValue = dtstart.includes(':') ? dtstart.split(':').slice(1).join(':').trim() : dtstart
    const allDay = /^\d{8}$/.test(rawValue)

    events.push({
      id: uid,
      title: summary,
      start: parseIcalDatetime(dtstart),
      end: parseIcalDatetime(dtend),
      allDay,
      location: location ?? null,
      url: url ?? null,
      accountId,
      accountLabel,
      provider: 'caldav',
      color,
    })
  }

  return events
}

// ── CalDAV HTTP helpers ───────────────────────────────────────────────────────

function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

async function propfind(url: string, auth: string, depth: string, body: string): Promise<string> {
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: depth,
    },
    body,
  })
  if (res.status === 401) throw new Error('CalDAV authentication failed — check username and password')
  if (!res.ok) throw new Error(`CalDAV PROPFIND failed: ${res.status} ${res.statusText}`)
  return res.text()
}

function extractXmlProp(xml: string, ...tagNames: string[]): string | null {
  for (const tag of tagNames) {
    const match = xml.match(new RegExp(`<[^:>]*:?${tag}[^>]*>\\s*([^<]+)\\s*<`, 'i'))
    if (match) return match[1].trim()
    const hrefMatch = xml.match(new RegExp(`<[^:>]*:?${tag}[^>]*>\\s*<[^:>]*:?href[^>]*>\\s*([^<]+)`, 'i'))
    if (hrefMatch) return hrefMatch[1].trim()
  }
  return null
}

function extractHrefs(xml: string): string[] {
  const hrefs: string[] = []
  const regex = /<[^:>]*:?href[^>]*>([^<]+)<\/[^:>]*:?href>/gi
  let m
  while ((m = regex.exec(xml)) !== null) hrefs.push(m[1].trim())
  return hrefs
}

function extractCalendarData(xml: string): string[] {
  const results: string[] = []
  const regex = /<[^:>]*:?calendar-data[^>]*>([\s\S]*?)<\/[^:>]*:?calendar-data>/gi
  let m
  while ((m = regex.exec(xml)) !== null) {
    const data = m[1].trim()
    if (data) results.push(data)
  }
  return results
}

// ── Discovery ─────────────────────────────────────────────────────────────────

async function discoverPrincipal(baseUrl: string, auth: string): Promise<string> {
  // Try well-known first
  try {
    const origin = new URL(baseUrl).origin
    const wellKnown = `${origin}/.well-known/caldav`
    const res = await fetch(wellKnown, { method: 'HEAD', headers: { Authorization: auth }, redirect: 'follow' })
    if (res.ok || res.status === 207) return res.url
  } catch { /* fall through */ }

  // PROPFIND on the given URL to get current-user-principal
  const xml = await propfind(baseUrl, auth, '0', `
    <D:propfind xmlns:D="DAV:">
      <D:prop><D:current-user-principal/></D:prop>
    </D:propfind>`)

  const principalHref = extractXmlProp(xml, 'current-user-principal')
  if (!principalHref) return baseUrl

  const base = new URL(baseUrl)
  return principalHref.startsWith('http') ? principalHref : `${base.origin}${principalHref}`
}

async function discoverCalendarHome(principalUrl: string, auth: string): Promise<string> {
  const xml = await propfind(principalUrl, auth, '0', `
    <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop><C:calendar-home-set/></D:prop>
    </D:propfind>`)

  const homeHref = extractXmlProp(xml, 'calendar-home-set')
  if (!homeHref) return principalUrl

  const base = new URL(principalUrl)
  return homeHref.startsWith('http') ? homeHref : `${base.origin}${homeHref}`
}

async function listCalendarUrls(homeUrl: string, auth: string): Promise<string[]> {
  const xml = await propfind(homeUrl, auth, '1', `
    <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:resourcetype/>
        <D:href/>
      </D:prop>
    </D:propfind>`)

  // Keep only hrefs that appear in calendar-collection responses
  const calendarBlocks = xml.match(/<D:response[\s\S]*?<\/D:response>/gi) ?? []
  const base = new URL(homeUrl)
  const urls: string[] = []

  for (const block of calendarBlocks) {
    if (!block.toLowerCase().includes('calendar')) continue
    const hrefs = extractHrefs(block)
    for (const href of hrefs) {
      if (!href || href === homeUrl || href === '/') continue
      const full = href.startsWith('http') ? href : `${base.origin}${href}`
      if (!urls.includes(full)) urls.push(full)
    }
  }

  return urls.length ? urls : [homeUrl]
}

// ── Report ────────────────────────────────────────────────────────────────────

function toUtcCompact(iso: string): string {
  // Convert ISO to compact UTC format CalDAV expects: 20240101T000000Z
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

async function reportEvents(calendarUrl: string, auth: string, start: string, end: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${toUtcCompact(start)}" end="${toUtcCompact(end)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`

  const res = await fetch(calendarUrl, {
    method: 'REPORT',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: '1',
    },
    body,
  })

  if (res.status === 401) throw new Error('CalDAV authentication failed')
  if (!res.ok) throw new Error(`CalDAV REPORT failed: ${res.status} ${res.statusText}`)
  return res.text()
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function testCalDAVConnection(
  url: string,
  username: string,
  password: string
): Promise<{ ok: boolean; displayName: string; error?: string }> {
  try {
    const auth = basicAuth(username, password)
    const xml = await propfind(url, auth, '0', `
      <D:propfind xmlns:D="DAV:">
        <D:prop><D:displayname/></D:prop>
      </D:propfind>`)
    const name = extractXmlProp(xml, 'displayname') ?? url
    return { ok: true, displayName: name }
  } catch (e) {
    return { ok: false, displayName: '', error: (e as Error).message }
  }
}

export async function fetchCalDAVEvents(
  serverUrl: string,
  username: string,
  password: string,
  start: string,
  end: string,
  accountId: number,
  accountLabel: string,
  color: string
): Promise<CalendarEvent[]> {
  const auth = basicAuth(username, password)
  const events: CalendarEvent[] = []

  try {
    // Full auto-discovery: principal → calendar-home → individual calendars
    const principal = await discoverPrincipal(serverUrl, auth)
    const home = await discoverCalendarHome(principal, auth)
    const calendarUrls = await listCalendarUrls(home, auth)

    for (const calUrl of calendarUrls) {
      try {
        const xml = await reportEvents(calUrl, auth, start, end)
        const icalBlocks = extractCalendarData(xml)
        for (const ical of icalBlocks) {
          events.push(...parseVEvents(ical, accountId, accountLabel, color))
        }
      } catch { /* skip unreachable individual calendar */ }
    }
  } catch {
    // Fall back: try REPORT directly on the provided URL
    const xml = await reportEvents(serverUrl, auth, start, end)
    const icalBlocks = extractCalendarData(xml)
    for (const ical of icalBlocks) {
      events.push(...parseVEvents(ical, accountId, accountLabel, color))
    }
  }

  return events
}
