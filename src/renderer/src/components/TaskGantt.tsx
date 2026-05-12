import type { Todo } from '../../../shared/types'

const STATUS_COLORS: Record<string, string> = {
  planning:'#9699a6', ready_for_design:'#0073ea', ready_for_review:'#9f57f7',
  need_it:'#ff7b00', hold:'#e2445c', in_progress:'#00c875', complete:'#00854d',
}
const STATUS_LABELS: Record<string, string> = {
  planning:'Planning', ready_for_design:'Ready for Design', ready_for_review:'Ready for Review',
  need_it:'Need IT', hold:'On Hold', in_progress:'In Progress', complete:'Complete',
}

interface Props {
  tasks: Todo[]
  projectDueDate?: string | null
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const iso = s.includes('T') ? s : s.replace(' ', 'T')
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  return isNaN(d.getTime()) ? null : d
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function TaskGantt({ tasks, projectDueDate }: Props): JSX.Element | null {
  const datedTasks = tasks.filter((t) => {
    if (t.task_status === 'complete') return false
    const effectiveDue = t.due_date ?? (t.is_recurring ? t.recurrence_next_date : null)
    if (!effectiveDue) return false
    return parseDate(effectiveDue) !== null
  })

  if (datedTasks.length === 0) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Date range: earliest task start → latest due date (+ padding)
  const allStarts = datedTasks.map((t) => parseDate(t.start_date ?? t.created_at)!).filter(Boolean)
  const allEnds   = datedTasks.map((t) => parseDate(t.due_date ?? t.recurrence_next_date)!).filter(Boolean)
  if (projectDueDate) { const pd = parseDate(projectDueDate); if (pd) allEnds.push(pd) }

  const rawMin = new Date(Math.min(...allStarts.map((d) => d.getTime())))
  const rawMax = new Date(Math.max(...allEnds.map((d) => d.getTime())))

  // Snap to week boundaries for clean grid
  const minDate = new Date(rawMin)
  minDate.setDate(minDate.getDate() - minDate.getDay()) // prev Sunday
  minDate.setHours(0, 0, 0, 0)

  const maxDate = addDays(rawMax, 7)
  const totalDays = Math.max(daysBetween(minDate, maxDate), 7)

  const pct = (d: Date) => Math.max(0, Math.min(100, (daysBetween(minDate, d) / totalDays) * 100))

  // Build week tick marks (every 7 days)
  const ticks: { label: string; pct: number }[] = []
  const cursor = new Date(minDate)
  while (cursor <= maxDate) {
    ticks.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pct: pct(cursor)
    })
    cursor.setDate(cursor.getDate() + 7)
  }

  const todayPct = pct(today)
  const showToday = todayPct >= 0 && todayPct <= 100

  const projDuePct = projectDueDate ? pct(parseDate(projectDueDate) ?? today) : null

  const BAR_H = 26
  const LABEL_W = 140

  return (
    <div className="gantt-wrap">
      <h3 className="gantt-title">Timeline</h3>
      <div className="gantt-chart" style={{ padding: '12px 0 12px 12px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', marginLeft: LABEL_W, position: 'relative', height: 28, marginBottom: 4, borderBottom: '1px solid #e6e9f0' }}>
          {ticks.map((tick) => (
            <div key={tick.label} style={{
              position: 'absolute', left: `${tick.pct}%`,
              fontSize: 10, color: '#9699a6', transform: 'translateX(-50%)',
              whiteSpace: 'nowrap', bottom: 4
            }}>
              {tick.label}
            </div>
          ))}
          {/* Today marker line in header */}
          {showToday && (
            <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 2, background: '#e2445c', opacity: 0.7 }} />
          )}
          {/* Project due date line in header */}
          {projDuePct !== null && (
            <div style={{ position: 'absolute', left: `${projDuePct}%`, top: 0, bottom: 0, width: 2, background: '#9f57f7', opacity: 0.7 }} />
          )}
        </div>

        {/* Task rows */}
        {datedTasks.map((task) => {
          const effectiveDue = task.due_date ?? task.recurrence_next_date
          const start   = parseDate(task.start_date ?? task.created_at)!
          const end     = parseDate(effectiveDue)!
          const leftPct = pct(start)
          const widthPct = Math.max(0.8, pct(end) - leftPct)
          const color   = STATUS_COLORS[task.task_status] ?? '#9699a6'
          const isOverdue = end < today
          const barColor  = isOverdue ? '#e2445c' : color

          return (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, height: BAR_H }}>
              {/* Left label */}
              <div style={{
                width: LABEL_W, minWidth: LABEL_W, paddingRight: 10,
                fontSize: 12, color: '#323338', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right'
              }} title={task.title}>
                {task.title}
              </div>

              {/* Track */}
              <div style={{ flex: 1, position: 'relative', height: BAR_H, background: '#f0f2f8', borderRadius: 6, overflow: 'hidden' }}>

                {/* Today line */}
                {showToday && (
                  <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 2, background: '#e2445c', opacity: 0.5, zIndex: 2 }} />
                )}
                {/* Project due date line */}
                {projDuePct !== null && (
                  <div style={{ position: 'absolute', left: `${projDuePct}%`, top: 0, bottom: 0, width: 2, background: '#9f57f7', opacity: 0.5, zIndex: 2 }} />
                )}

                {/* Task bar */}
                <div
                  title={`${STATUS_LABELS[task.task_status]} · Due ${effectiveDue}${task.is_recurring ? ' ↻' : ''}${isOverdue ? ' (OVERDUE)' : ''}`}
                  style={{
                    position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`,
                    height: '100%', background: barColor, borderRadius: 6,
                    display: 'flex', alignItems: 'center', padding: '0 8px',
                    overflow: 'hidden', zIndex: 1
                  }}
                >
                  {/* Status dot */}
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0, marginRight: 5 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {STATUS_LABELS[task.task_status]}
                    {task.due_date ? ` · ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginLeft: LABEL_W, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9699a6' }}>
            <span style={{ width: 2, height: 12, background: '#e2445c', display: 'inline-block' }} /> Today
          </span>
          {projDuePct !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9699a6' }}>
              <span style={{ width: 2, height: 12, background: '#9f57f7', display: 'inline-block' }} /> Project due date
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
