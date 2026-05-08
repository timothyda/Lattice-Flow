import { useState } from 'react'
import type { Phase } from '../../../shared/types'
import TodoList from './TodoList'

import type { Todo } from '../../../shared/types'

interface Props {
  phase: Phase
  onUpdated: (updated: Phase) => void
  onDeleted: (id: number) => void
  onOpenTask?: (todo: Todo) => void
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'Planning',
  active:   'Active',
  complete: 'Complete',
}

const STATUS_NEXT: Record<string, Phase['status']> = {
  planning: 'active',
  active:   'complete',
  complete: 'planning',
}

export default function PhaseCard({ phase, onUpdated, onDeleted, onOpenTask }: Props): JSX.Element {
  const [editingDates, setEditingDates] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [draftStart, setDraftStart] = useState(phase.planned_start ?? '')
  const [draftEnd, setDraftEnd]     = useState(phase.planned_end ?? '')
  const [draftDesc, setDraftDesc]   = useState(phase.description)

  const saveDates = async () => {
    const updated = await window.api.phases.update(phase.id, {
      planned_start: draftStart || null,
      planned_end:   draftEnd   || null,
    }) as Phase
    setEditingDates(false)
    onUpdated(updated)
  }

  const saveDesc = async () => {
    const updated = await window.api.phases.update(phase.id, { description: draftDesc }) as Phase
    setEditingDesc(false)
    onUpdated(updated)
  }

  const cycleStatus = async () => {
    const next = STATUS_NEXT[phase.status] ?? 'planning'
    const updated = await window.api.phases.update(phase.id, { status: next }) as Phase
    onUpdated(updated)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete phase "${phase.name}"? All its todos will be removed.`)) return
    await window.api.phases.delete(phase.id)
    onDeleted(phase.id)
  }

  return (
    <div className={`phase-card phase-card-${phase.status}`} id={`phase-${phase.id}`}>
      <div className="phase-card-header">
        <div className="phase-card-title-row">
          <h3 className="phase-card-name">{phase.name}</h3>
          <button
            className={`phase-status-badge phase-status-${phase.status}`}
            onClick={cycleStatus}
            title="Click to advance status"
          >
            {STATUS_LABELS[phase.status]}
          </button>
          <button className="phase-card-delete" onClick={handleDelete} title="Delete phase">×</button>
        </div>

        {/* Description */}
        {editingDesc ? (
          <div className="phase-desc-edit">
            <input
              className="phase-desc-input"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="Short description…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveDesc()
                if (e.key === 'Escape') { setDraftDesc(phase.description); setEditingDesc(false) }
              }}
              autoFocus
            />
            <button className="phase-desc-save" onClick={saveDesc}>Save</button>
            <button className="phase-desc-cancel" onClick={() => { setDraftDesc(phase.description); setEditingDesc(false) }}>Cancel</button>
          </div>
        ) : (
          <p
            className="phase-card-desc"
            onClick={() => setEditingDesc(true)}
            title="Click to edit description"
          >
            {phase.description || <span className="phase-desc-placeholder">Add description…</span>}
          </p>
        )}

        {/* Date range */}
        {editingDates ? (
          <div className="phase-date-edit">
            <label>Start</label>
            <input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} />
            <label>End</label>
            <input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} />
            <button className="phase-date-save" onClick={saveDates}>Save</button>
            <button className="phase-date-cancel" onClick={() => { setDraftStart(phase.planned_start ?? ''); setDraftEnd(phase.planned_end ?? ''); setEditingDates(false) }}>Cancel</button>
          </div>
        ) : (
          <button className="phase-date-range" onClick={() => setEditingDates(true)} title="Edit dates">
            {phase.planned_start && phase.planned_end
              ? `${phase.planned_start} → ${phase.planned_end}`
              : 'Set dates…'}
          </button>
        )}
      </div>

      <div className="phase-card-body">
        <TodoList projectId={phase.project_id} phaseId={phase.id} onOpenTask={onOpenTask} />
      </div>
    </div>
  )
}
