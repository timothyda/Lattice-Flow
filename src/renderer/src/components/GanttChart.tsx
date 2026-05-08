import { useEffect, useState } from 'react'
import type { Phase, PhaseDateHistory } from '../../../shared/types'

interface Props {
  phases: Phase[]
  projectId: number
}

const STATUS_COLOR: Record<string, string> = {
  planning: '#9ca3af',
  active:   '#6366f1',
  complete: '#10b981',
}

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export default function GanttChart({ phases, projectId: _projectId }: Props): JSX.Element | null {
  const [histories, setHistories] = useState<Record<number, PhaseDateHistory[]>>({})

  useEffect(() => {
    const phasesWithDates = phases.filter((p) => p.planned_start && p.planned_end)
    Promise.all(
      phasesWithDates.map((p) =>
        (window.api.phases.history(p.id) as Promise<PhaseDateHistory[]>).then((h) => ({ id: p.id, h }))
      )
    ).then((results) => {
      const map: Record<number, PhaseDateHistory[]> = {}
      results.forEach(({ id, h }) => { map[id] = h })
      setHistories(map)
    })
  }, [phases])

  const datedPhases = phases.filter((p) => p.planned_start && p.planned_end)
  if (datedPhases.length === 0) return null

  const starts = datedPhases.map((p) => parseDate(p.planned_start)!).filter(Boolean)
  const ends   = datedPhases.map((p) => parseDate(p.planned_end)!).filter(Boolean)
  const minDate = new Date(Math.min(...starts.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...ends.map((d) => d.getTime())))
  const totalDays = Math.max(daysBetween(minDate, maxDate), 1)

  // Build month tick marks
  const months: { label: string; left: number }[] = []
  const cursor = new Date(minDate)
  cursor.setDate(1)
  while (cursor <= maxDate) {
    const left = (daysBetween(minDate, cursor) / totalDays) * 100
    if (left >= 0) months.push({ label: formatMonthLabel(cursor), left: Math.max(left, 0) })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return (
    <div className="gantt-wrap">
      <h3 className="gantt-title">Timeline</h3>
      <div className="gantt-chart">
        {/* Month labels */}
        <div className="gantt-axis">
          {months.map((m) => (
            <span key={m.label + m.left} className="gantt-month" style={{ left: `${m.left}%` }}>
              {m.label}
            </span>
          ))}
        </div>

        {/* Phase bars */}
        <div className="gantt-rows">
          {datedPhases.map((phase) => {
            const start = parseDate(phase.planned_start)!
            const end   = parseDate(phase.planned_end)!
            const leftPct  = (daysBetween(minDate, start) / totalDays) * 100
            const widthPct = (daysBetween(start, end) / totalDays) * 100
            const color = STATUS_COLOR[phase.status] ?? STATUS_COLOR.planning

            // Find original end from history (first record's old_end)
            const hist = histories[phase.id] ?? []
            const originalEnd = hist.length > 0 ? parseDate(hist[0].old_end) : null
            let baseWidth = widthPct
            let extWidth = 0
            if (originalEnd && originalEnd < end) {
              baseWidth = (daysBetween(start, originalEnd) / totalDays) * 100
              extWidth  = (daysBetween(originalEnd, end) / totalDays) * 100
            }

            const extTitle = hist.length > 0
              ? `Extended ${hist.length}x — original end: ${hist[0].old_end}`
              : ''

            return (
              <div key={phase.id} className="gantt-row">
                <span className="gantt-row-label">{phase.name}</span>
                <div className="gantt-row-track">
                  <div
                    className="gantt-bar-wrap"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={extTitle || `${phase.planned_start} → ${phase.planned_end}`}
                  >
                    <div className="gantt-bar-base" style={{ width: `${(baseWidth / widthPct) * 100}%`, background: color }} />
                    {extWidth > 0 && (
                      <div className="gantt-bar-ext" style={{ width: `${(extWidth / widthPct) * 100}%` }} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
