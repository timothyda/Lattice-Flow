import { useState, useEffect, useCallback } from 'react'
import type { User, CalendarEvent, LinkedMeeting, Project } from '../../../shared/types'
import EventCard from '../components/EventCard'
import LinkEventModal from '../components/LinkEventModal'

// ── Date helpers ──────────────────────────────────────────────────────────────

function weekStart(from: Date): Date {
  const d = new Date(from)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const map = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const day = isoDay(new Date(ev.start))
    const group = map.get(day) ?? []
    group.push(ev)
    map.set(day, group)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  currentUser: User | null
  projects: Project[]
  onOpenSettings: () => void
}

export default function CalendarView({ currentUser, projects, onOpenSettings }: Props): JSX.Element {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [evLoading, setEvLoading] = useState(false)
  const [evError, setEvError] = useState<string | null>(null)
  const [week, setWeek] = useState(() => weekStart(new Date()))
  const [linkingEvent, setLinkingEvent] = useState<CalendarEvent | null>(null)
  const [linkedMap, setLinkedMap] = useState<Map<string, LinkedMeeting>>(new Map())
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null)

  const refreshLinked = useCallback(async () => {
    const rows = await window.api.meetings.listLinked()
    setLinkedMap(new Map(rows.map((r) => [r.calendar_event_id, r])))
  }, [])

  useEffect(() => { refreshLinked() }, [refreshLinked])

  // Check if user has any connected accounts
  useEffect(() => {
    if (!currentUser) return
    window.api.calendar.getAccounts(currentUser.id).then((accounts) => {
      setHasAccounts(accounts.length > 0)
    })
  }, [currentUser])

  // Fetch events for the displayed week
  useEffect(() => {
    if (!currentUser || !hasAccounts) return
    const start = week.toISOString()
    const end = addDays(week, 7).toISOString()
    setEvLoading(true)
    setEvError(null)
    window.api.calendar.fetchEvents(currentUser.id, start, end)
      .then(setEvents)
      .catch((err: Error) => setEvError(err.message))
      .finally(() => setEvLoading(false))
  }, [currentUser, hasAccounts, week])

  // ── No accounts connected ──────────────────────────────────────────────────

  if (hasAccounts === false) {
    return (
      <div className="cal-auth-prompt">
        <div className="cal-auth-icon">📅</div>
        <h2 className="cal-auth-title">No Calendar Connected</h2>
        <p className="cal-auth-body">
          Connect a Microsoft, Google, Zoom, or CalDAV account to see your events here
          and link them to projects.
        </p>
        <button className="btn-primary" onClick={onOpenSettings}>
          Open Settings → Calendar
        </button>
      </div>
    )
  }

  // ── Week navigation labels ──────────────────────────────────────────────────

  const weekEnd = addDays(week, 6)
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  const weekLabel = `${fmt.format(week)} – ${fmt.format(weekEnd)}, ${week.getFullYear()}`
  const isCurrentWeek = isoDay(week) === isoDay(weekStart(new Date()))

  const grouped = groupByDay(events)

  return (
    <div className="cal-view">
      <div className="cal-header">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => setWeek((w) => addDays(w, -7))}>‹</button>
          <span className="cal-week-label">{weekLabel}</span>
          <button className="cal-nav-btn" onClick={() => setWeek((w) => addDays(w, 7))}>›</button>
          {!isCurrentWeek && (
            <button className="cal-today-btn" onClick={() => setWeek(weekStart(new Date()))}>
              Today
            </button>
          )}
        </div>
        <button
          className="btn-secondary"
          style={{ fontSize: 12, padding: '4px 12px' }}
          onClick={onOpenSettings}
        >
          Manage accounts
        </button>
      </div>

      <div className="cal-body">
        {evLoading && <div className="cal-spinner">Fetching events…</div>}

        {evError && (
          <div className="cal-error">
            <strong>Could not load some events:</strong> {evError}
          </div>
        )}

        {!evLoading && !evError && grouped.length === 0 && (
          <div className="cal-empty">No events this week</div>
        )}

        {!evLoading && grouped.map(([day, dayEvents]) => (
          <div key={day} className="cal-day">
            <div className="cal-day-label">
              {new Date(`${day}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric'
              })}
            </div>
            <div className="cal-day-events">
              {dayEvents.map((ev) => (
                <EventCard
                  key={`${ev.provider}-${ev.id}`}
                  event={ev}
                  linkedInfo={linkedMap.get(ev.id)}
                  onLink={setLinkingEvent}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {linkingEvent && (
        <LinkEventModal
          event={linkingEvent}
          projects={projects}
          onClose={() => setLinkingEvent(null)}
          onLinked={() => { setLinkingEvent(null); refreshLinked() }}
        />
      )}
    </div>
  )
}
