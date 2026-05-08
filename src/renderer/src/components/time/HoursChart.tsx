import type { TimeSession } from '../../../../shared/types'

const USER_COLORS = ['#0073ea', '#9f57f7', '#00c875', '#ff7b00', '#e2445c', '#0091b5', '#ff5ac4']

function fmtH(mins: number): string {
  if (mins === 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

interface Props {
  sessions: TimeSession[]
}

export default function HoursChart({ sessions }: Props): JSX.Element {
  const completed = sessions.filter((s) => s.ended_at != null && s.duration_minutes != null)

  if (completed.length === 0) {
    return (
      <section className="time-section">
        <h3 className="time-section-title">
          <span className="time-section-icon">📊</span>Time Breakdown
        </h3>
        <p className="time-empty">No completed sessions yet — time breakdown will appear after clocking out.</p>
      </section>
    )
  }

  // ── By task ────────────────────────────────────────────────────────────────
  const taskMap = new Map<string, number>()
  for (const s of completed) {
    const label = s.todo_title ?? '(No task)'
    taskMap.set(label, (taskMap.get(label) ?? 0) + (s.duration_minutes ?? 0))
  }
  const taskRows = [...taskMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // top 10 tasks

  const maxTaskMins = taskRows.length > 0 ? taskRows[0][1] : 1

  // ── By user ────────────────────────────────────────────────────────────────
  const userMap = new Map<string, number>()
  for (const s of completed) {
    userMap.set(s.user_name, (userMap.get(s.user_name) ?? 0) + (s.duration_minutes ?? 0))
  }
  const userRows = [...userMap.entries()].sort((a, b) => b[1] - a[1])
  const maxUserMins = userRows.length > 0 ? userRows[0][1] : 1

  const totalMins = completed.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)

  return (
    <section className="time-section">
      <h3 className="time-section-title">
        <span className="time-section-icon">📊</span>Time Breakdown
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 400, color: '#676879' }}>
          Total: <strong style={{ color: '#323338' }}>{fmtH(totalMins)}</strong>
        </span>
      </h3>

      {/* ── Time by task ── */}
      {taskRows.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            By Task
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {taskRows.map(([label, mins]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 130, minWidth: 130, fontSize: 12, color: '#323338', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }} title={label}>
                  {label}
                </div>
                <div style={{ flex: 1, background: '#f0f2f8', borderRadius: 6, height: 22, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${(mins / maxTaskMins) * 100}%`,
                    height: '100%',
                    background: '#0073ea',
                    borderRadius: 6,
                    minWidth: 4,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ width: 52, minWidth: 52, fontSize: 12, fontWeight: 600, color: '#0073ea', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtH(mins)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Time by person ── */}
      {userRows.length > 0 && (
        <div style={{ marginTop: taskRows.length > 0 ? 20 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            By Team Member
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {userRows.map(([name, mins], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 130, minWidth: 130, fontSize: 12, color: '#323338', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }} title={name}>
                  {name}
                </div>
                <div style={{ flex: 1, background: '#f0f2f8', borderRadius: 6, height: 22, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(mins / maxUserMins) * 100}%`,
                    height: '100%',
                    background: USER_COLORS[i % USER_COLORS.length],
                    borderRadius: 6,
                    minWidth: 4,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ width: 52, minWidth: 52, fontSize: 12, fontWeight: 600, color: USER_COLORS[i % USER_COLORS.length], textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtH(mins)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
