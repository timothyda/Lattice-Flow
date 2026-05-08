import { useState, useEffect, useCallback } from 'react'
import type { TimeSession, User, TaskStatus } from '../../../shared/types'
import ActiveTimer from './time/ActiveTimer'
import HoursChart from './time/HoursChart'
import TimeStats from './time/TimeStats'
import LogTimeModal from './time/LogTimeModal'

interface Props {
  projectId: number
  focusTodoId?: number | null
  focusTodoTitle?: string | null
}

export default function TimeTab({ projectId, focusTodoId, focusTodoTitle }: Props): JSX.Element {
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
    await window.api.time.clockOut(sessionId, note || undefined, subtaskTitle)
    if (newTaskStatus && currentUser) {
      const session = activeSessions.find((s) => s.id === sessionId)
      if (session?.todo_id) {
        await window.api.todos.updateStatus(session.todo_id, newTaskStatus, currentUser.id)
      }
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
      <TimeStats sessions={sessions} users={users} onSessionDeleted={refresh} />

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
