import { useState } from 'react'
import type { TaskStatus, UserRole } from '../../../../shared/types'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, ROLE_LABELS } from '../../../../shared/types'

interface Props {
  todoId: number | null
  todoTitle: string | null
  userRole: UserRole | null
  sessionId: number
  subtaskOptions: string[]
  onConfirm: (sessionId: number, note: string, newTaskStatus: TaskStatus | null, subtaskTitle: string | null) => Promise<void>
  onCancel: () => void
}

const CLOCK_OUT_STATUSES: { status: TaskStatus; desc: string }[] = [
  { status: 'in_progress',      desc: 'Still working' },
  { status: 'pm_in_progress',   desc: 'With project manager' },
  { status: 'ready_for_review', desc: 'Send for review' },
  { status: 'ready_for_design', desc: 'Back to design' },
  { status: 'need_it',          desc: 'Waiting on IT' },
  { status: 'hold',             desc: 'Put on hold' },
  { status: 'complete',         desc: 'Done ✓' },
]

export default function ClockOutDialog({
  todoId, todoTitle, userRole, sessionId, subtaskOptions, onConfirm, onCancel
}: Props): JSX.Element {
  const [note, setNote] = useState('')
  const [newStatus, setNewStatus] = useState<TaskStatus>('in_progress')
  const [subtask, setSubtask] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    setSaving(true)
    try { await onConfirm(sessionId, note, todoId ? newStatus : null, subtask || null) }
    finally { setSaving(false) }
  }

  const roleLabel = userRole ? ROLE_LABELS[userRole] : ''
  const inProgressLabel = roleLabel ? `${roleLabel} In Progress` : 'In Progress'

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 'min(460px, 95vw)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="modal-title" style={{ marginBottom: 0 }}>Clock Out</div>

        {todoTitle && (
          <div style={{
            background: '#f0f2f8', borderRadius: 7, padding: '8px 12px',
            fontSize: 13, color: '#323338'
          }}>
            <span style={{ color: '#676879', fontSize: 11, display: 'block', marginBottom: 1 }}>Task</span>
            <strong>{todoTitle}</strong>
          </div>
        )}

        {subtaskOptions.length > 0 && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Subtask <span className="field-optional">(optional)</span></label>
            <select value={subtask} onChange={(e) => setSubtask(e.target.value)}>
              <option value="">— None —</option>
              {subtaskOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="field" style={{ marginBottom: 0 }}>
          <label>Note <span className="field-optional">(optional)</span></label>
          <textarea
            rows={2}
            placeholder="What did you work on?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus={subtaskOptions.length === 0}
          />
        </div>

        {todoId && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#323338', marginBottom: 8 }}>
              Update task status
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 6
            }}>
              {CLOCK_OUT_STATUSES.map(({ status, desc }) => {
                const label = status === 'in_progress' ? inProgressLabel : TASK_STATUS_LABELS[status]
                const color = TASK_STATUS_COLORS[status]
                const active = newStatus === status
                return (
                  <button
                    key={status}
                    onClick={() => setNewStatus(status)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      gap: 2, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${active ? color : '#e6e9f0'}`,
                      background: active ? `${color}14` : '#fff',
                      textAlign: 'left', transition: 'all 0.1s'
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: active ? color : '#323338' }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 10, color: '#9699a6' }}>{desc}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #f0f2f8' }}>
          <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving…' : 'Clock Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
