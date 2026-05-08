import { useState, useEffect } from 'react'
import type { User, Todo } from '../../../../shared/types'

interface Props {
  projectId: number
  currentUser: User
  onClose: () => void
  onSaved: () => void
}

interface FieldErrors {
  date?: string
  startTime?: string
  endTime?: string
}

function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
}

// Convert a local date + local time string into a UTC "YYYY-MM-DD HH:MM:SS"
function toUtcStorage(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString().replace('T', ' ').slice(0, 19)
}

export default function LogTimeModal({ projectId, currentUser, onClose, onSaved }: Props): JSX.Element {
  const today = todayLocal()
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [todos, setTodos] = useState<Todo[]>([])
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null)
  const [subtaskOptions, setSubtaskOptions] = useState<string[]>([])
  const [selectedSubtask, setSelectedSubtask] = useState('')

  useEffect(() => {
    window.api.todos.list(projectId).then((t) => setTodos(t as Todo[]))
  }, [projectId])

  useEffect(() => {
    if (!selectedTodoId) { setSubtaskOptions([]); setSelectedSubtask(''); return }
    window.api.taskTemplates.subtasksForTodo(selectedTodoId).then((opts) => {
      setSubtaskOptions(opts)
      setSelectedSubtask('')
    })
  }, [selectedTodoId])

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {}
    if (!date) {
      errs.date = 'Date is required.'
    } else if (date > today) {
      errs.date = 'Date cannot be in the future.'
    }
    if (!startTime) errs.startTime = 'Start time is required.'
    if (!endTime) {
      errs.endTime = 'End time is required.'
    } else if (startTime && endTime) {
      const start = new Date(`${date}T${startTime}`)
      const end = new Date(`${date}T${endTime}`)
      if (end <= start) errs.endTime = 'End time must be after start time.'
    }
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      const startDt = new Date(`${date}T${startTime}`)
      const endDt = new Date(`${date}T${endTime}`)
      const durationMinutes = Math.round((endDt.getTime() - startDt.getTime()) / 60_000)
      await window.api.time.logManual({
        project_id: projectId,
        user_id: currentUser.id,
        user_name: currentUser.display_name,
        todo_id: selectedTodoId ?? null,
        subtask_title: selectedSubtask || null,
        started_at: toUtcStorage(date, startTime),
        ended_at: toUtcStorage(date, endTime),
        duration_minutes: durationMinutes,
        note: note.trim() || null
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  // Derive a human-readable duration for live preview
  let durationPreview = ''
  if (date && startTime && endTime) {
    const diffMs = new Date(`${date}T${endTime}`).getTime() - new Date(`${date}T${startTime}`).getTime()
    if (diffMs > 0) {
      const totalMins = Math.round(diffMs / 60_000)
      const h = Math.floor(totalMins / 60)
      const m = totalMins % 60
      durationPreview = h > 0
        ? (m > 0 ? `${h}h ${m}m` : `${h}h`)
        : `${m}m`
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose} onKeyDown={handleKeyDown}>
      <div className="modal ltm-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Log Time Manually</h2>
        <p className="ltm-user-line">Logging as <strong>{currentUser.display_name}</strong></p>

        <div className="field">
          <label htmlFor="ltm-date">Date</label>
          <input
            id="ltm-date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: undefined })) }}
          />
          {errors.date && <span className="form-error">{errors.date}</span>}
        </div>

        <div className="ltm-time-row">
          <div className="field ltm-time-field">
            <label htmlFor="ltm-start">Start time</label>
            <input
              id="ltm-start"
              type="time"
              value={startTime}
              onChange={(e) => { setStartTime(e.target.value); setErrors((p) => ({ ...p, startTime: undefined })) }}
            />
            {errors.startTime && <span className="form-error">{errors.startTime}</span>}
          </div>

          <div className="ltm-time-sep">→</div>

          <div className="field ltm-time-field">
            <label htmlFor="ltm-end">End time</label>
            <input
              id="ltm-end"
              type="time"
              value={endTime}
              onChange={(e) => { setEndTime(e.target.value); setErrors((p) => ({ ...p, endTime: undefined })) }}
            />
            {errors.endTime && <span className="form-error">{errors.endTime}</span>}
          </div>

          {durationPreview && (
            <div className="ltm-duration-preview">{durationPreview}</div>
          )}
        </div>

        {todos.length > 0 && (
          <div className="field">
            <label htmlFor="ltm-task">Task <span className="ltm-optional">(optional)</span></label>
            <select
              id="ltm-task"
              value={selectedTodoId ?? ''}
              onChange={(e) => setSelectedTodoId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— None —</option>
              {todos.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        {subtaskOptions.length > 0 && (
          <div className="field">
            <label htmlFor="ltm-subtask">Subtask <span className="ltm-optional">(optional)</span></label>
            <select
              id="ltm-subtask"
              value={selectedSubtask}
              onChange={(e) => setSelectedSubtask(e.target.value)}
            >
              <option value="">— None —</option>
              {subtaskOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="ltm-note">Note <span className="ltm-optional">(optional)</span></label>
          <input
            id="ltm-note"
            type="text"
            placeholder="What did you work on?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
