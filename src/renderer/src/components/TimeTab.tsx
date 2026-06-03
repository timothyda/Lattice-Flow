import { useState, useEffect, useCallback } from 'react'
import type { TimeSession, User, TaskStatus, TaskFile, Todo } from '../../../shared/types'
import ActiveTimer from './time/ActiveTimer'
import HoursChart from './time/HoursChart'
import TimeStats from './time/TimeStats'
import LogTimeModal from './time/LogTimeModal'

const STATUS_COLORS: Record<string, string> = {
  planning:         '#676879',
  ready_for_design: '#0073ea',
  ready_for_review: '#9f57f7',
  pm_in_progress:   '#0073ea',
  need_it:          '#ff7b00',
  hold:             '#e2445c',
  in_progress:      '#00c875',
  complete:         '#00854d',
}
const STATUS_LABELS: Record<string, string> = {
  planning:         'Planning',
  ready_for_design: 'Ready for Design',
  ready_for_review: 'Ready for Review',
  pm_in_progress:   'PM In Progress',
  need_it:          'Need IT',
  hold:             'On Hold',
  in_progress:      'In Progress',
  complete:         'Complete',
}
const STATUS_ORDER: TaskStatus[] = [
  'planning','ready_for_design','ready_for_review','pm_in_progress','need_it','hold','in_progress','complete'
]

interface Props {
  projectId: number
  focusTodoId?: number | null
  focusTodoTitle?: string | null
  showOvertimeAlerts?: boolean
  budgetMins?: number | null
}

export default function TimeTab({ projectId, focusTodoId, focusTodoTitle, showOvertimeAlerts, budgetMins }: Props): JSX.Element {
  const [sessions, setSessions] = useState<TimeSession[]>([])
  const [activeSessions, setActiveSessions] = useState<TimeSession[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLogModal, setShowLogModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [pausedTodo, setPausedTodo] = useState<{ id: number | null; title: string | null } | null>(null)
  const [focusFiles, setFocusFiles] = useState<TaskFile[]>([])

  // Task editing state
  const [focusTodo, setFocusTodo] = useState<Todo | null>(null)
  const [showTaskEdit, setShowTaskEdit] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editStatus, setEditStatus] = useState<TaskStatus>('planning')
  const [editPriority, setEditPriority] = useState('normal')
  const [editSaving, setEditSaving] = useState(false)

  const refresh = useCallback(async () => {
    const [sess, active] = await Promise.all([
      window.api.time.getSessionsByProject(projectId),
      window.api.time.getActiveSessions(projectId)
    ])
    setSessions(sess)
    setActiveSessions(active)
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.api.time.getSessionsByProject(projectId),
      window.api.time.getActiveSessions(projectId),
      window.api.users.list(),
      window.api.auth.getCurrentUser()
    ]).then(([sess, active, usr, me]) => {
      setSessions(sess as TimeSession[])
      setActiveSessions(active as TimeSession[])
      setUsers(usr as User[])
      setCurrentUser(me as User | null)
      setLoading(false)
    })
  }, [projectId])

  useEffect(() => {
    const id = setInterval(() => {
      window.api.time.getActiveSessions(projectId).then((a) => setActiveSessions(a as TimeSession[]))
    }, 10_000)
    return () => clearInterval(id)
  }, [projectId])

  useEffect(() => {
    const todoId = focusTodoId ?? null
    if (!todoId) {
      setFocusFiles([])
      setFocusTodo(null)
      return
    }
    Promise.all([
      window.api.taskFiles.list(todoId),
      window.api.todos.get(todoId)
    ]).then(([files, todo]) => {
      setFocusFiles(files as TaskFile[])
      if (todo) {
        const t = todo as Todo
        setFocusTodo(t)
        setEditDesc(t.description ?? '')
        setEditStatus(t.task_status ?? 'planning')
        setEditPriority(t.priority ?? 'normal')
      }
    })
  }, [focusTodoId])

  const handleAddFile = useCallback(async () => {
    if (!focusTodoId) return
    const paths = await window.api.dialog.pickFiles()
    for (const raw of paths) {
      try {
        const added = await window.api.taskFiles.add(focusTodoId, raw, window.api.path.basename(raw))
        setFocusFiles((prev) => [...prev, added as TaskFile])
      } catch (e) { console.warn('file attach failed', e) }
    }
  }, [focusTodoId])

  const handleRemoveFile = useCallback(async (id: number) => {
    await window.api.taskFiles.remove(id)
    setFocusFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const handleSaveTaskEdit = useCallback(async () => {
    if (!focusTodo) return
    setEditSaving(true)
    try {
      const updated = await window.api.todos.update(focusTodo.id, {
        description: editDesc,
        priority: editPriority as Todo['priority'],
      }) as Todo | undefined
      if (editStatus !== focusTodo.task_status) {
        await window.api.todos.updateStatus(focusTodo.id, editStatus, currentUser?.id)
      }
      setFocusTodo((prev) => prev ? { ...prev, description: editDesc, priority: editPriority as Todo['priority'], task_status: editStatus, ...(updated ?? {}) } : prev)
      setShowTaskEdit(false)
    } finally {
      setEditSaving(false)
    }
  }, [focusTodo, editDesc, editStatus, editPriority, currentUser])

  const handleClockIn = useCallback(async (todoId?: number | null) => {
    if (!currentUser) return
    await window.api.time.clockIn(projectId, currentUser.id, todoId)
    setPausedTodo(null)
    await refresh()
  }, [projectId, currentUser, refresh])

  const handlePause = useCallback(async (sessionId: number) => {
    const session = activeSessions.find((s) => s.id === sessionId)
    await window.api.time.clockOut(sessionId, 'Paused')
    setPausedTodo({ id: session?.todo_id ?? null, title: session?.todo_title ?? null })
    await refresh()
  }, [activeSessions, refresh])

  const handleResume = useCallback(async () => {
    if (!currentUser) return
    await window.api.time.clockIn(projectId, currentUser.id, pausedTodo?.id ?? null)
    setPausedTodo(null)
    await refresh()
  }, [projectId, currentUser, pausedTodo, refresh])

  const handleClockOut = useCallback(async (
    sessionId: number,
    note: string,
    newTaskStatus: TaskStatus | null,
    subtaskTitle: string | null
  ) => {
    const todoId = activeSessions.find((s) => s.id === sessionId)?.todo_id ?? null
    await window.api.time.clockOut(sessionId, note || undefined, subtaskTitle)
    if (newTaskStatus && currentUser && todoId) {
      await window.api.todos.updateStatus(todoId, newTaskStatus, currentUser.id)
    }
    await refresh()
  }, [refresh, activeSessions, currentUser])

  const handleExport = async () => {
    setExporting(true)
    setExportMsg(null)
    try {
      const savedPath = await window.api.time.exportCsv(projectId)
      setExportMsg(savedPath ? `Saved to ${savedPath}` : null)
    } finally {
      setExporting(false)
    }
    setTimeout(() => setExportMsg(null), 4000)
  }

  if (loading) {
    return (
      <div className="time-tab">
        <div className="time-loading">
          <div className="time-loading-spinner" />
          <span>Loading time data…</span>
        </div>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[focusTodo?.task_status ?? 'planning'] ?? '#676879'

  return (
    <div className="time-tab">
      <div className="time-toolbar">
        <button
          className="time-toolbar-btn"
          onClick={() => setShowLogModal(true)}
          disabled={!currentUser}
        >
          + Log time manually
        </button>
        <button
          className="time-toolbar-btn time-toolbar-btn-export"
          onClick={handleExport}
          disabled={exporting || sessions.filter((s) => s.ended_at).length === 0}
        >
          {exporting ? 'Exporting…' : '↓ Export CSV'}
        </button>
        {exportMsg && <span className="time-export-msg">{exportMsg}</span>}
      </div>

      {budgetMins != null && (() => {
        const loggedMins = sessions.filter((s) => s.duration_minutes != null).reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
        const pct = Math.min(100, Math.round((loggedMins / budgetMins) * 100))
        const overBudget = loggedMins > budgetMins
        const barColor = overBudget ? '#e2445c' : pct >= 80 ? '#ff7b00' : '#0073ea'
        const fmtMins = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; return min > 0 ? `${h}h ${min}m` : `${h}h` }
        return (
          <div style={{ margin: '0 0 16px', padding: '14px 16px', background: 'var(--surface-sub)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Time Budget</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: overBudget ? '#e2445c' : 'var(--text-2)' }}>
                {fmtMins(loggedMins)} / {fmtMins(budgetMins)} &nbsp;
                <span style={{ fontSize: 11, fontWeight: 400 }}>({pct}%)</span>
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            {overBudget
              ? <div style={{ marginTop: 6, fontSize: 11, color: '#e2445c', fontWeight: 600 }}>Over budget by {fmtMins(loggedMins - budgetMins)}</div>
              : <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>{fmtMins(budgetMins - loggedMins)} remaining</div>
            }
          </div>
        )
      })()}

      {/* Task card — shown when focused on a specific task */}
      {focusTodoId && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, flexShrink: 0,
                color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}44`
              }}>
                {STATUS_LABELS[focusTodo?.task_status ?? 'planning'] ?? 'Planning'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {focusTodo?.title ?? focusTodoTitle ?? '…'}
              </span>
            </div>
            <button
              onClick={() => {
                setEditDesc(focusTodo?.description ?? '')
                setEditStatus(focusTodo?.task_status ?? 'planning')
                setEditPriority(focusTodo?.priority ?? 'normal')
                setShowTaskEdit(true)
              }}
              style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-str)', background: 'var(--surface-rsd)', color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0 }}
            >
              Edit task
            </button>
          </div>

          {/* Description */}
          {focusTodo?.description && (
            <div style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, borderBottom: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
              {focusTodo.description}
            </div>
          )}

          {/* Files */}
          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Attached files {focusFiles.length > 0 && `(${focusFiles.length})`}
              </span>
              <button
                onClick={handleAddFile}
                style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border-str)', background: 'var(--surface-rsd)', color: 'var(--text-2)', cursor: 'pointer' }}
              >
                + Add file
              </button>
            </div>

            {focusFiles.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No files attached</span>
            )}

            {focusFiles.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{ fontSize: 13, color: 'var(--accent)', cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={f.file_path}
                  onClick={() => {
                    window.api.fs.openFile(f.file_path)
                    window.api.recentFiles.record(0, projectId, f.file_path, f.file_name).catch(() => {})
                  }}
                >
                  📎 {f.file_name}
                </span>
                <button
                  onClick={() => handleRemoveFile(f.id)}
                  title="Remove file"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-3)', flexShrink: 0, padding: '0 2px', lineHeight: 1 }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ActiveTimer
        currentUser={currentUser}
        activeSessions={activeSessions}
        focusTodoId={pausedTodo !== null ? pausedTodo.id : focusTodoId}
        focusTodoTitle={pausedTodo !== null ? pausedTodo.title : focusTodoTitle}
        pausedTodo={pausedTodo}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
        onPause={handlePause}
        onResume={handleResume}
      />
      <HoursChart sessions={sessions} />
      <TimeStats sessions={sessions} users={users} onSessionDeleted={refresh} showOvertimeAlerts={showOvertimeAlerts} />

      {showLogModal && currentUser && (
        <LogTimeModal
          projectId={projectId}
          currentUser={currentUser}
          onClose={() => setShowLogModal(false)}
          onSaved={async () => { setShowLogModal(false); await refresh() }}
        />
      )}

      {/* Task edit modal */}
      {showTaskEdit && focusTodo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '24px 24px 20px', width: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{focusTodo.title}</span>
              <button onClick={() => setShowTaskEdit(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}>×</button>
            </div>

            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border-str)', background: 'var(--surface-rsd)', color: 'var(--text-1)', fontSize: 13, outline: 'none' }}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Priority</label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border-str)', background: 'var(--surface-rsd)', color: 'var(--text-1)', fontSize: 13, outline: 'none' }}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Description</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={5}
                placeholder="Add a description…"
                style={{ padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--border-str)', background: 'var(--surface-rsd)', color: 'var(--text-1)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setShowTaskEdit(false)}
                style={{ padding: '7px 16px', borderRadius: 6, border: '1.5px solid var(--border-str)', background: 'transparent', color: 'var(--text-1)', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTaskEdit}
                disabled={editSaving}
                style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.6 : 1 }}
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
