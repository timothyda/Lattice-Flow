import { Fragment } from 'react'
import type React from 'react'
import type { TimeSession, User } from '../../../../shared/types'

function fmtHours(totalMins: number): string {
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (totalMins === 0) return '0h'
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtDate(dtStr: string): string {
  return new Date(dtStr.replace(' ', 'T') + 'Z').toLocaleDateString([], {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function fmtDateTime(dtStr: string): string {
  return new Date(dtStr.replace(' ', 'T') + 'Z').toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

interface Props {
  sessions: TimeSession[]
  users: User[]
  onSessionDeleted: (id: number) => void
  showOvertimeAlerts?: boolean
}

export default function TimeStats({ sessions, users, onSessionDeleted, showOvertimeAlerts }: Props): JSX.Element {
  const handleDeleteSession = async (id: number) => {
    if (!window.confirm('Delete this session?')) return
    await window.api.time.deleteSession(id)
    onSessionDeleted(id)
  }
  const completed = sessions.filter((s) => s.duration_minutes != null)

  const userStats = [...new Set(completed.map((s) => s.user_name))]
    .map((name) => {
      const userSessions = completed.filter((s) => s.user_name === name)
      const totalMins = userSessions.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0)
      const lastActive = userSessions.reduce((latest, s) =>
        !latest || s.started_at > latest ? s.started_at : latest, '')
      const dbUser = users.find((u) => u.display_name === name)
      return {
        name,
        totalMins,
        sessionCount: userSessions.length,
        lastActive,
        avatarUrl: dbUser?.avatar_url ?? null
      }
    })
    .sort((a, b) => b.totalMins - a.totalMins)

  const projectTotalMins = completed.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0)
  const uniqueDays = new Set(completed.map((s) => s.started_at.slice(0, 10))).size
  const avgDailyMins = uniqueDays > 0 ? Math.round(projectTotalMins / uniqueDays) : 0

  const sessionDurationColor = (mins: number): React.CSSProperties | undefined => {
    if (!showOvertimeAlerts) return undefined
    if (mins > 600) return { color: '#c0392b', fontWeight: 700 }
    if (mins > 480) return { color: '#e67e22', fontWeight: 700 }
    return undefined
  }

  if (completed.length === 0) {
    return (
      <section className="time-section">
        <h3 className="time-section-title">
          <span className="time-section-icon">📊</span>Team Summary
        </h3>
        <p className="time-empty">Summary will appear once sessions are completed.</p>
      </section>
    )
  }

  return (
    <section className="time-section">
      <h3 className="time-section-title">
        <span className="time-section-icon">📊</span>Team Summary
      </h3>

      <table className="time-stats-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Sessions</th>
            <th>Total Hours</th>
            <th>Last Active</th>
          </tr>
        </thead>
        <tbody>
          {userStats.map((stat) => (
            <tr key={stat.name}>
              <td>
                <div className="time-user-cell">
                  {stat.avatarUrl ? (
                    <img className="time-avatar" src={stat.avatarUrl} alt={stat.name} />
                  ) : (
                    <span className="time-avatar-initials">{stat.name.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="time-user-name">{stat.name}</span>
                </div>
              </td>
              <td className="time-stat-num">{stat.sessionCount}</td>
              <td className="time-stat-num">{fmtHours(stat.totalMins)}</td>
              <td className="time-stat-date">{stat.lastActive ? fmtDate(stat.lastActive) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="time-project-totals">
        <div className="time-total-item">
          <span className="time-total-value">{fmtHours(projectTotalMins)}</span>
          <span className="time-total-label">Project Total</span>
        </div>
        <div className="time-total-divider" />
        <div className="time-total-item">
          <span className="time-total-value">{fmtHours(avgDailyMins)}</span>
          <span className="time-total-label">Avg Daily</span>
        </div>
        <div className="time-total-divider" />
        <div className="time-total-item">
          <span className="time-total-value">{uniqueDays}</span>
          <span className="time-total-label">Active Days</span>
        </div>
      </div>

      <h4 className="time-section-subtitle">Session History</h4>
      <table className="time-stats-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Member</th>
            <th>Task</th>
            <th>Subtask</th>
            <th>Duration</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {completed.map((s) => (
            <Fragment key={s.id}>
              <tr>
                <td className="time-stat-date">{fmtDateTime(s.started_at)}</td>
                <td className="time-user-name">{s.user_name}</td>
                <td className="time-session-note">{s.todo_title ?? <span className="time-no-note">—</span>}</td>
                <td className="time-session-note">
                  {s.subtask_title
                    ? <span style={{ background: 'var(--surface-rsd)', color: 'var(--text-2)', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>{s.subtask_title}</span>
                    : <span className="time-no-note">—</span>}
                </td>
                <td className="time-stat-num" style={sessionDurationColor(s.duration_minutes ?? 0)}>{fmtHours(s.duration_minutes ?? 0)}</td>
                <td>
                  <button
                    className="session-delete-btn"
                    title="Delete session"
                    onClick={() => handleDeleteSession(s.id)}
                  >×</button>
                </td>
              </tr>
              {s.note && (
                <tr>
                  <td colSpan={6} style={{ paddingTop: 0, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-sub)', borderRadius: 6, padding: '5px 10px', borderLeft: '2px solid var(--border-str)' }}>
                      {s.note}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  )
}
