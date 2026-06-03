import { useState, useEffect, useCallback } from 'react'
import type { TimeSession, User, TaskStatus, TaskFile } from '../../../shared/types'
import ActiveTimer from './time/ActiveTimer'
import HoursChart from './time/HoursChart'
import TimeStats from './time/TimeStats'
import LogTimeModal from './time/LogTimeModal'

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
  // Pause state: stores the todo context when a session is paused so Resume can re-clock in
  const [pausedTodo, setPausedTodo] = useState<{ id: number | null; title: string | null } | null>(null)
  const [focusFiles, setFocusFiles] = useState<TaskFile[]>([])

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
    if (!todoId) { setFocusFiles([]); return }
    window.api.taskFiles.list(todoId).then((f) => setFocusFiles(f as TaskFile[]))
  }, [focusTodoId])

  const handleClockIn = useCallback(async (todoId?: number | null) => {
    if (!currentUser) return
    await window.api.time.clockIn(projectId, currentUser.id, todoId)
    setPausedTodo(null)
    await refresh()
  }, [projectId, currentUser, refresh])

  const handlePause = useCallback(async (sessionId: number) => {
    // Find the session being paused so we can resume to the same task
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
    // Capture todo_id synchronously before any await so the session lookup
    // is never affected by the 10-second polling interval clearing activeSessions.
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
          <div style={{ margin: '0 0 16px', padding: '14px 16px', background: '#f9fafb', border: '1px solid #e6e9f0', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#323338' }}>Time Budget</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: overBudget ? '#e2445c' : '#676879' }}>
                {fmtMins(loggedMins)} / {fmtMins(budgetMins)} &nbsp;
                <span style={{ fontSize: 11, fontWeight: 400 }}>({pct}%)</span>
              </span>
            </div>
            <div style={{ height: 8, background: '#e6e9f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            {overBudget && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#e2445c', fontWeight: 600 }}>
                Over budget by {fmtMins(loggedMins - budgetMins)}
              </div>
            )}
            {!overBudget && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#9699a6' }}>
                {fmtMins(budgetMins - loggedMins)} remaining
              </div>
            )}
          </div>
        )
      })()}

      {focusFiles.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#f0f6ff', border: '1px solid #cce0ff', borderRadius: 8, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#676879', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attached files</div>
          {focusFiles.map((f) => (
            <span
              key={f.id}
              style={{ fontSize: 13, color: '#0073ea', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={f.file_path}
              onClick={() => {
                window.api.fs.openFile(f.file_path)
                window.api.recentFiles.record(0, projectId, f.file_path, f.file_name).catch(() => {})
              }}
            >
              📎 {f.file_name}
            </span>
          ))}
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
    </div>
  )
}
