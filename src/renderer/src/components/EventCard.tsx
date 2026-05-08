import type { CalendarEvent, LinkedMeeting } from '../../../shared/types'
import { PROVIDER_LABELS } from '../../../shared/types'

interface Props {
  event: CalendarEvent
  linkedInfo: LinkedMeeting | undefined
  onLink: (event: CalendarEvent) => void
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function EventCard({ event, linkedInfo, onLink }: Props): JSX.Element {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60_000)

  const timeLabel = event.allDay
    ? 'All day'
    : `${fmtTime(event.start)} – ${fmtTime(event.end)}`

  return (
    <div
      className={`ev-card${linkedInfo ? ' ev-card-linked' : ''}`}
      style={{ borderLeft: `4px solid ${event.color}` }}
    >
      <div className="ev-card-top">
        <div className="ev-time">
          {timeLabel}
          {!event.allDay && durationMin > 0 && durationMin < 480 && (
            <span className="ev-duration">{durationMin}m</span>
          )}
        </div>
        <span className="ev-provider-badge" style={{ background: event.color }}>
          {PROVIDER_LABELS[event.provider]}
        </span>
      </div>
      <div className="ev-subject">{event.title}</div>
      {event.location && (
        <div className="ev-location">📍 {event.location}</div>
      )}
      <div className="ev-footer">
        {linkedInfo ? (
          <span className="ev-linked-badge">🔗 {linkedInfo.project_name}</span>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="ev-link-btn" onClick={() => onLink(event)}>
              Link to Project
            </button>
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: event.color, textDecoration: 'none', fontWeight: 600 }}
              >
                Join ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
