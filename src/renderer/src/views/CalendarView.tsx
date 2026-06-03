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

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthGridDays(m: Date): Date[] {
  const first = new Date(m.getFullYear(), m.getMonth(), 1)
  const gridStart = weekStart(first)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
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

type CalView = 'week' | 'month'

interface Props {
  currentUser: User | null
  projects: Project[]
  onOpenSettings: () => void
}

export default function CalendarView({ currentUser, projects, onOpenSettings }: Props): JSX.Element {
  const [view, setView] = useState<CalView>('week')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [evLoading, setEvLoading] = useState(false)
  const [evError, setEvError] = useState<string | null>(null)
  const [week, setWeek] = useState(() => weekStart(new Date()))
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [linkingEvent, setLinkingEvent] = useState<CalendarEvent | null>(null)
  const [linkedMap, setLinkedMap] = useState<Map<string, LinkedMeeting>>(new Map())
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null)

  const refreshLinked = useCallback(async () => {
    const rows = await window.api.meetings.listLinked()
    setLinkedMap(new Map(rows.map((r) => [r.calendar_event_id, r])))
  }, [])

  useEffect(() => { refreshLinked() }, [refreshLinked])

  useEffect(() => {
    if (!currentUser) return
    window.api.calendar.getAccounts(currentUser.id).then((accounts) => {
      setHasAccounts(accounts.length > 0)
    })
  }, [currentUser])

  // Fetch events for the active view's range
  useEffect(() => {
    if (!currentUser || !hasAccounts) return
    let start: string, end: string
    if (view === 'week') {
      start = week.toISOString()
      end = addDays(week, 7).toISOString()
    } else {
      const grid = monthGridDays(month)
      start = grid[0].toISOString()
      end = addDays(grid[41], 1).toISOString()
    }
    setEvLoading(true)
    setEvError(null)
    window.api.calendar.fetchEvents(currentUser.id, start, end)
      .then(setEvents)
      .catch((err: Error) => setEvError(err.message))
      .finally(() => setEvLoading(false))
  }, [currentUser, hasAccounts, week, month, view])

  // Sync period when switching views
  const switchView = (next: CalView) => {
    if (next === view) return
    if (next === 'month') {
      setMonth(new Date(week.getFullYear(), week.getMonth(), 1))
    } else {
      setWeek(weekStart(new Date(month.getFullYear(), month.getMonth(), 1)))
    }
    setView(next)
  }

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

  // ── Header labels & navigation ─────────────────────────────────────────────

  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  const weekEnd = addDays(week, 6)
  const weekLabel = `${fmt.format(week)} – ${fmt.format(weekEnd)}, ${week.getFullYear()}`
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isCurrentWeek = isoDay(week) === isoDay(weekStart(new Date()))
  const isCurrentMonth = isoDay(month) === isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  const navPrev = () => view === 'week' ? setWeek((w) => addDays(w, -7)) : setMonth((m) => addMonths(m, -1))
  const navNext = () => view === 'week' ? setWeek((w) => addDays(w, 7))  : setMonth((m) => addMonths(m, 1))
  const navToday = () => {
    setWeek(weekStart(new Date()))
    setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  }

  const showToday = view === 'week' ? !isCurrentWeek : !isCurrentMonth

  // ── Month grid ─────────────────────────────────────────────────────────────

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayStr = isoDay(new Date())

  const evByDay = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const day = isoDay(new Date(ev.start))
    const arr = evByDay.get(day) ?? []
    arr.push(ev)
    evByDay.set(day, arr)
  }

  const grouped = groupByDay(events)

  return (
    <div className="cal-view">
      <div className="cal-header">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={navPrev}>‹</button>
          <span className="cal-week-label">{view === 'week' ? weekLabel : monthLabel}</span>
          <button className="cal-nav-btn" onClick={navNext}>›</button>
          {showToday && (
            <button className="cal-today-btn" onClick={navToday}>Today</button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="cal-view-toggle">
            <button
              className={`cal-view-toggle-btn${view === 'week' ? ' active' : ''}`}
              onClick={() => switchView('week')}
            >
              Week
            </button>
            <button
              className={`cal-view-toggle-btn${view === 'month' ? ' active' : ''}`}
              onClick={() => switchView('month')}
            >
              Month
            </button>
          </div>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={onOpenSettings}
          >
            Manage accounts
          </button>
        </div>
      </div>

      {/* ── Week view ── */}
      {view === 'week' && (
        <div className="cal-body">
          {evLoading && <div className="cal-spinner">Fetching events…</div>}
          {evError && <div className="cal-error"><strong>Could not load some events:</strong> {evError}</div>}
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
      )}

      {/* ── Month view ── */}
      {view === 'month' && (
        <div className="cal-month-wrap">
          {evError && <div className="cal-error" style={{ margin: '12px 24px 0' }}><strong>Could not load some events:</strong> {evError}</div>}

          <div className="cal-month-grid">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="cal-month-weekday">{wd}</div>
            ))}

            {monthGridDays(month).map((day) => {
              const dayStr = isoDay(day)
              const isToday = dayStr === todayStr
              const isOtherMonth = day.getMonth() !== month.getMonth()
              const dayEvs = evByDay.get(dayStr) ?? []
              const visible = dayEvs.slice(0, 3)
              const overflow = dayEvs.length - 3

              return (
                <div
                  key={dayStr}
                  className={`cal-month-cell${isToday ? ' today' : ''}${isOtherMonth ? ' other-month' : ''}`}
                >
                  <div className="cal-month-day-num">{day.getDate()}</div>
                  {evLoading && dayStr === isoDay(monthGridDays(month)[0]) && (
                    <div style={{ fontSize: 10, color: '#9699a6', padding: '2px 4px' }}>Loading…</div>
                  )}
                  {visible.map((ev) => (
                    <div
                      key={`${ev.provider}-${ev.id}`}
                      className="cal-month-event-pill"
                      style={{ borderLeftColor: ev.color }}
                      onClick={() => setLinkingEvent(ev)}
                      title={ev.title}
                    >
                      {!ev.allDay && (
                        <span className="cal-month-event-time">
                          {new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                      <span className="cal-month-event-title">{ev.title}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="cal-month-more">+{overflow} more</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
