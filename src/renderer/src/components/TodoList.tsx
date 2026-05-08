import { useState, useEffect, useRef, useCallback } from 'react'
import type { Todo, TaskStatus, TodoPriority, TimeSession } from '../../../shared/types'

// Defined locally to avoid any bundle-resolution issues with shared constants
const STATUS_COLORS: Record<string, string> = {
  planning:         '#676879',
  ready_for_design: '#0073ea',
  ready_for_review: '#9f57f7',
  need_it:          '#ff7b00',
  hold:             '#e2445c',
  in_progress:      '#00c875',
  complete:         '#00854d',
}
const STATUS_LABELS: Record<string, string> = {
  planning:         'Planning',
  ready_for_design: 'Ready for Design',
  ready_for_review: 'Ready for Review',
  need_it:          'Need IT',
  hold:             'On Hold',
  in_progress:      'In Progress',
  complete:         'Complete',
}

interface Props {
  projectId: number
  phaseId?: number | null
  onChanged?: () => void
  onOpenTask?: (todo: Todo) => void
}

const STATUS_ORDER: TaskStatus[] = [
  'planning', 'ready_for_design', 'ready_for_review', 'need_it', 'hold', 'in_progress', 'complete'
]

const PRIORITY_OPTIONS: { value: TodoPriority; label: string; color: string }[] = [
  { value: 'low',    label: 'Low',    color: '#9699a6' },
  { value: 'normal', label: 'Normal', color: '#0073ea' },
  { value: 'high',   label: 'High',   color: '#ff7b00' },
  { value: 'urgent', label: 'Urgent', color: '#e2445c' },
]

// ── Status badge with dropdown ─────────────────────────────────────────────────

function StatusBadge({ todo, onChange }: { todo: Todo; onChange: (s: TaskStatus) => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const status = todo.task_status ?? 'planning'
  const color  = STATUS_COLORS[status] ?? '#676879'
  const label  = STATUS_LABELS[status] ?? status

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        title="Change status"
        style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
          color, background: `${color}18`, border: `1px solid ${color}44`,
          cursor: 'pointer', whiteSpace: 'nowrap'
        }}
      >
        {label} ▾
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e6e9f0', borderRadius: 10,
          boxShadow: '0 6px 24px rgba(0,0,0,0.13)', zIndex: 50,
          minWidth: 190, maxHeight: 280, overflowY: 'auto'
        }}>
          {STATUS_ORDER.map((s) => {
            const c = STATUS_COLORS[s]
            const isActive = s === status
            return (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 12px', background: isActive ? `${c}12` : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12,
                  color: '#323338', borderLeft: isActive ? `3px solid ${c}` : '3px solid transparent'
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{STATUS_LABELS[s]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Inline new-task form ───────────────────────────────────────────────────────

interface NewTaskFormProps {
  projectId: number
  phaseId?: number | null
  onCreated: (todo: Todo) => void
  onCancel: () => void
}

function NewTaskForm({ projectId, phaseId, onCreated, onCancel }: NewTaskFormProps): JSX.Element {
  const [title,    setTitle]    = useState('')
  const [desc,     setDesc]     = useState('')
  const [status,   setStatus]   = useState<TaskStatus>('planning')
  const [priority, setPriority] = useState<TodoPriority>('normal')
  const [dueDate,  setDueDate]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSave = async () => {
    const t = title.trim()
    if (!t) return
    setSaving(true)
    try {
      const created = await window.api.todos.create({
        project_id:  projectId,
        phase_id:    phaseId ?? null,
        title:       t,
        description: desc.trim(),
        priority,
        due_date:    dueDate || null,
        task_status: status
      }) as Todo

      // Apply routing if status has routing rules
      try {
        const currentUser = await window.api.auth.getCurrentUser() as { id: number } | null
        if (status !== 'planning') {
          await window.api.todos.updateStatus(created.id, status, currentUser?.id)
        }
      } catch (routeErr) {
        console.warn('[TodoList] routing failed (non-fatal):', routeErr)
      }

      onCreated(created)
    } catch (err) {
      console.error('[TodoList] failed to create task:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#f9fafb', border: '1.5px solid #0073ea', borderRadius: 10,
      padding: 14, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10
    }}>
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
        placeholder="Task title…"
        style={{ border: '1.5px solid #c3c6d4', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%', background: '#fff' }}
      />
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description (optional)…"
        rows={2}
        style={{ border: '1.5px solid #c3c6d4', borderRadius: 6, padding: '7px 10px', fontSize: 12, outline: 'none', width: '100%', background: '#fff', resize: 'vertical', fontFamily: 'inherit' }}
      />

      {/* Status */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#676879', width: 52 }}>Status</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {STATUS_ORDER.filter((s) => s !== 'complete' && s !== 'in_progress').map((s) => {
            const c = STATUS_COLORS[s]
            const active = s === status
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 8,
                  color: active ? '#fff' : c,
                  background: active ? c : `${c}18`,
                  border: `1px solid ${active ? c : `${c}44`}`,
                  cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {STATUS_LABELS[s]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Priority + Due date */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#676879' }}>Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoPriority)}
            style={{
              border: '1.5px solid #c3c6d4', borderRadius: 6, padding: '3px 6px',
              fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer'
            }}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#676879' }}>Due</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{
              border: '1.5px solid #c3c6d4', borderRadius: 6, padding: '3px 6px',
              fontSize: 12, outline: 'none', background: '#fff'
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '5px 14px', border: '1.5px solid #c3c6d4', borderRadius: 6,
            background: '#fff', fontSize: 12, cursor: 'pointer', color: '#676879'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          style={{
            padding: '5px 14px', border: 'none', borderRadius: 6,
            background: title.trim() ? '#0073ea' : '#c3c6d4', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'default'
          }}
        >
          {saving ? 'Adding…' : 'Add Task'}
        </button>
      </div>
    </div>
  )
}

// ── Edit Task Modal ───────────────────────────────────────────────────────────

function EditTaskModal({ todo, onClose, onSaved }: { todo: Todo; onClose: () => void; onSaved: (updated: Todo) => void }): JSX.Element {
  const [title,    setTitle]    = useState(todo.title)
  const [desc,     setDesc]     = useState(todo.description ?? '')
  const [priority, setPriority] = useState<TodoPriority>(todo.priority ?? 'normal')
  const [dueDate,  setDueDate]  = useState(todo.due_date ?? '')
  const [saving,   setSaving]   = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const updated = await window.api.todos.update(todo.id, {
        title:       title.trim(),
        description: desc.trim(),
        priority,
        due_date:    dueDate || null
      }) as Todo
      onSaved(updated)
    } catch (err) { console.error('[EditTaskModal]', err) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Edit Task</div>

        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
        </div>

        <div className="field">
          <label>Description <span className="field-optional">(optional)</span></label>
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Add notes or context for this task…" />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TodoPriority)}>
              {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
            <label>Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Detail Modal ─────────────────────────────────────────────────────────

function fmtDuration(mins: number | null): string {
  if (!mins) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function fmtDateTime(utc: string): string {
  return new Date(utc.replace(' ', 'T') + 'Z').toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  })
}

function TaskDetailModal({ todo, onClose }: { todo: Todo; onClose: () => void }): JSX.Element {
  const [sessions, setSessions] = useState<TimeSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.time.getSessionsByTodo(todo.id)
      .then((data) => setSessions(data as TimeSession[]))
      .finally(() => setLoading(false))
  }, [todo.id])

  // Only count sessions that have been fully clocked out
  const completedSessions = sessions.filter((s) => s.ended_at && s.duration_minutes != null)
  const totalMins = completedSessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
  const status = todo.task_status ?? 'planning'
  const color = STATUS_COLORS[status] ?? '#676879'
  const label = STATUS_LABELS[status] ?? status

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}
        onClick={(e) => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="modal-title" style={{ marginBottom: 6 }}>{todo.title}</div>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
              color, background: `${color}18`, border: `1px solid ${color}44`
            }}>{label}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9699a6', flexShrink: 0 }}>×</button>
        </div>

        {/* Task meta */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#676879' }}>
          {todo.priority && <span>Priority: <strong style={{ color: '#323338' }}>{todo.priority}</strong></span>}
          {todo.due_date && <span>Due: <strong style={{ color: '#323338' }}>{new Date(todo.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>}
          {todo.completed_at && <span>Completed: <strong style={{ color: '#323338' }}>{new Date(todo.completed_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong></span>}
        </div>

        {/* Description */}
        {todo.description && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#676879', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {todo.description}
          </div>
        )}

        {/* Time summary */}
        <div style={{ background: '#f0f7ff', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#676879', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Time Logged</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0073ea', lineHeight: 1 }}>{fmtDuration(totalMins)}</div>
          <div style={{ fontSize: 11, color: '#9699a6', marginTop: 4 }}>
            {completedSessions.length} completed session{completedSessions.length !== 1 ? 's' : ''}
            {sessions.length > completedSessions.length && (
              <span style={{ marginLeft: 6, color: '#ff7b00' }}>· {sessions.length - completedSessions.length} active</span>
            )}
          </div>
        </div>

        {/* Session list */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#323338', marginBottom: 8 }}>Sessions</div>
          {loading ? (
            <div style={{ fontSize: 13, color: '#9699a6' }}>Loading…</div>
          ) : completedSessions.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9699a6' }}>No completed time sessions yet. Clock in via the task's ⏱ button to log time.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {completedSessions.map((s) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: '#f9fafb',
                  borderRadius: 8, border: '1px solid #e6e9f0', fontSize: 12
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#323338', fontWeight: 500 }}>{s.user_name}</div>
                    <div style={{ color: '#9699a6', marginTop: 2 }}>
                      {fmtDateTime(s.started_at)}
                      {s.ended_at ? ` → ${fmtDateTime(s.ended_at)}` : ' (active)'}
                    </div>
                    {s.note && <div style={{ color: '#676879', marginTop: 2, fontStyle: 'italic' }}>{s.note}</div>}
                  </div>
                  <div style={{ fontWeight: 700, color: '#0073ea', flexShrink: 0, fontSize: 13 }}>
                    {fmtDuration(s.duration_minutes)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f0f2f8', paddingTop: 12 }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Main TodoList ─────────────────────────────────────────────────────────────

export default function TodoList({ projectId, phaseId, onChanged, onOpenTask }: Props): JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([])
  const [adding, setAdding] = useState(false)
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null)
  const [editTodo, setEditTodo] = useState<Todo | null>(null)

  const load = () => {
    window.api.todos.list(projectId, phaseId).then((data) => setTodos(data as Todo[]))
  }

  useEffect(() => { load() }, [projectId, phaseId])

  const handleCreated = (todo: Todo) => {
    setTodos((prev) => [todo, ...prev])
    setAdding(false)
    onChanged?.()
  }

  const handleStatusChange = async (todo: Todo, newStatus: TaskStatus) => {
    const currentUser = await window.api.auth.getCurrentUser() as { id: number } | null
    const updated = await window.api.todos.updateStatus(todo.id, newStatus, currentUser?.id) as Todo
    setTodos((prev) => prev.map((t) => t.id === todo.id ? updated : t))
    onChanged?.()
  }

  const handleDelete = async (id: number) => {
    await window.api.todos.delete(id)
    setTodos((prev) => prev.filter((t) => t.id !== id))
    onChanged?.()
  }

  const open = todos.filter((t) => (t.task_status ?? 'planning') !== 'complete')
  const done = todos.filter((t) => (t.task_status ?? 'planning') === 'complete')

  return (
    <>
    {detailTodo && <TaskDetailModal todo={detailTodo} onClose={() => setDetailTodo(null)} />}
    {editTodo && (
      <EditTaskModal
        todo={editTodo}
        onClose={() => setEditTodo(null)}
        onSaved={(updated) => {
          setTodos((prev) => prev.map((t) => t.id === updated.id ? updated : t))
          setEditTodo(null)
          onChanged?.()
        }}
      />
    )}
    <div className="todo-list">
      <div className="todo-header">
        <h3 className="todo-title">Tasks</h3>
        {!adding && (
          <button className="todo-add-btn" onClick={() => setAdding(true)} title="Add task">+</button>
        )}
      </div>

      {adding && (
        <NewTaskForm
          projectId={projectId}
          phaseId={phaseId}
          onCreated={handleCreated}
          onCancel={() => setAdding(false)}
        />
      )}

      {open.length === 0 && !adding && (
        <p className="todo-empty">No open tasks — click + to add one.</p>
      )}

      {/* ── Open tasks — no height cap, parent phase-content scrolls ── */}
      {open.length > 0 && (
        <ul className="todo-items">
          {open.map((t) => (
            <li key={t.id} className="todo-item" style={{ alignItems: 'center', gap: 6, padding: '6px 2px' }}>
              <StatusBadge todo={t} onChange={(s) => handleStatusChange(t, s)} />

              <button
                className="todo-item-title"
                onClick={() => onOpenTask?.(t)}
                title={onOpenTask ? 'Click to open in Time tab' : undefined}
                style={{
                  background: 'none', border: 'none',
                  cursor: onOpenTask ? 'pointer' : 'default',
                  textAlign: 'left', padding: 0, flex: 1,
                  fontSize: 13, color: '#323338'
                }}
              >
                {t.title}
                {t.due_date && (
                  <span style={{
                    marginLeft: 8, fontSize: 10,
                    color: new Date(t.due_date) < new Date() ? '#e2445c' : '#9699a6'
                  }}>
                    Due {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </button>

              {onOpenTask && (
                <span className="task-clock-hint" style={{ fontSize: 10, color: '#0073ea', opacity: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ⏱ Start
                </span>
              )}
              <button
                onClick={() => setEditTodo(t)}
                title="Edit task"
                style={{ background: 'none', border: 'none', fontSize: 13, color: '#c3c6d4', cursor: 'pointer', padding: '0 2px', opacity: 0, transition: 'opacity 0.15s' }}
                className="task-edit-btn"
              >✎</button>
              <button className="todo-delete" onClick={() => handleDelete(t.id)} title="Delete">×</button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Completed tasks — separate scrollable panel ── */}
      {done.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#676879',
              textTransform: 'uppercase', letterSpacing: '0.06em'
            }}>
              Completed ({done.length})
            </span>
          </div>

          <div style={{ border: '1px solid #e6e9f0', borderRadius: 10, background: '#fafafa' }}>
            <ul className="todo-items" style={{ padding: '4px 0', margin: 0 }}>
              {done.map((t) => (
                <li key={t.id} className="todo-item todo-item-done" style={{ alignItems: 'center', gap: 6, padding: '6px 12px' }}>
                  <StatusBadge todo={t} onChange={(s) => handleStatusChange(t, s)} />
                  <button
                    onClick={() => setDetailTodo(t)}
                    title="View time & details"
                    style={{
                      flex: 1, background: 'none', border: 'none', textAlign: 'left',
                      padding: 0, cursor: 'pointer', fontSize: 13,
                      color: '#9699a6', textDecoration: 'line-through'
                    }}
                  >
                    {t.title}
                  </button>
                  {t.completed_at && (
                    <span style={{ fontSize: 10, color: '#c3c6d4', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(t.completed_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <button
                    style={{ background: 'none', border: 'none', fontSize: 11, color: '#0073ea', cursor: 'pointer', flexShrink: 0, padding: '0 4px' }}
                    onClick={() => setDetailTodo(t)}
                    title="View details"
                  >⏱</button>
                  <button className="todo-delete" onClick={() => handleDelete(t.id)} title="Delete">×</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
