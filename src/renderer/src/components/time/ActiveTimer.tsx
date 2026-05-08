import { useState, useEffect, useRef } from 'react'
import type { TimeSession, User, TaskStatus } from '../../../../shared/types'
import ClockOutDialog from './ClockOutDialog'

interface Props {
  currentUser: User | null
  activeSessions: TimeSession[]
  focusTodoId?: number | null
  focusTodoTitle?: string | null
  pausedTodo: { id: number | null; title: string | null } | null
  onClockIn: (todoId?: number | null) => Promise<void>
  onClockOut: (sessionId: number, note: string, newTaskStatus: TaskStatus | null, subtaskTitle: string | null) => Promise<void>
  onPause: (sessionId: number) => Promise<void>
  onResume: () => Promise<void>
}

function parseUTC(dtStr: string): Date {
  return new Date(dtStr.replace(' ', 'T') + 'Z')
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function fmtSince(dtStr: string): string {
  return parseUTC(dtStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ActiveTimer({
  currentUser, activeSessions, focusTodoId, focusTodoTitle,
  pausedTodo, onClockIn, onClockOut, onPause, onResume
}: Props): JSX.Element {
  const mySession = currentUser
    ? (activeSessions.find((s) => s.user_id === currentUser.id) ?? null)
    : null
  const otherSessions = activeSessions.filter((s) => s.user_id !== currentUser?.id)

  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [showClockOut, setShowClockOut] = useState(false)
  const [subtaskOptions, setSubtaskOptions] = useState<string[]>([])
  const loadedTodoId = useRef<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    if (!mySession) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [mySession?.id])

  useEffect(() => {
    const todoId = mySession?.todo_id ?? null
    if (todoId === loadedTodoId.current) return
    loadedTodoId.current = todoId
    if (todoId) {
      window.api.taskTemplates.subtasksForTodo(todoId).then(setSubtaskOptions)
    } else {
      setSubtaskOptions([])
    }
  }, [mySession?.todo_id])

  const handleClockIn = async () => {
    setBusy(true)
    try { await onClockIn(focusTodoId ?? null) } finally { setBusy(false) }
  }

  const handlePause = async () => {
    if (!mySession) return
    setBusy(true)
    try { await onPause(mySession.id) } finally { setBusy(false) }
  }

  const handleResume = async () => {
    setBusy(true)
    try { await onResume() } finally { setBusy(false) }
  }

  const handleClockOutConfirm = async (sessionId: number, note: string, newTaskStatus: TaskStatus | null, subtaskTitle: string | null) => {
    await onClockOut(sessionId, note, newTaskStatus, subtaskTitle)
    setShowClockOut(false)
  }

  const elapsed = mySession ? now - parseUTC(mySession.started_at).getTime() : 0
  const activeTaskTitle = mySession?.todo_title ?? focusTodoTitle
  const clockInLabel = focusTodoTitle ? `Clock In to "${focusTodoTitle}"` : 'Clock In'
  const isPaused = !mySession && !!pausedTodo

  return (
    <>
      <section className="time-section">
        <h3 className="time-section-title">
          <span className="time-section-icon">⏱</span>Active Timer
          {activeTaskTitle && (
            <span style={{ fontSize: 12, fontWeight: 400, color: '#676879', marginLeft: 8 }}>
              — {activeTaskTitle}
            </span>
          )}
          {isPaused && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#ff7b00', background: '#fff3e0', padding: '2px 8px', borderRadius: 8 }}>
              ⏸ PAUSED
            </span>
          )}
        </h3>

        {mySession ? (
          <div className="timer-running">
            <div className="timer-display">{fmtElapsed(elapsed)}</div>
            <p className="timer-since">Started at {fmtSince(mySession.started_at)}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="timer-btn"
                style={{ background: '#fff3e0', color: '#ff7b00' }}
                onClick={handlePause}
                disabled={busy}
              >
                ⏸ Pause
              </button>
              <button className="timer-btn timer-btn-out" onClick={() => setShowClockOut(true)} disabled={busy}>
                Clock Out
              </button>
            </div>
          </div>
        ) : isPaused ? (
          <div className="timer-idle">
            <p className="timer-idle-msg" style={{ color: '#ff7b00' }}>
              Paused{pausedTodo?.title ? ` — ${pausedTodo.title}` : ''}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="timer-btn timer-btn-in" onClick={handleResume} disabled={busy}>
                {busy ? 'Resuming…' : '▶ Resume'}
              </button>
            </div>
          </div>
        ) : (
          <div className="timer-idle">
            {currentUser ? (
              <>
                <p className="timer-idle-msg">You are not clocked in.</p>
                <button className="timer-btn timer-btn-in" onClick={handleClockIn} disabled={busy}>
                  {busy ? 'Starting…' : clockInLabel}
                </button>
              </>
            ) : (
              <p className="timer-idle-msg timer-auth-msg">Sign in to enable time tracking.</p>
            )}
          </div>
        )}

        {otherSessions.length > 0 && (
          <div className="timer-others">
            <p className="timer-others-label">
              {otherSessions.length === 1 ? '1 person' : `${otherSessions.length} people`} also clocked in
            </p>
            <ul className="timer-others-list">
              {otherSessions.map((s) => (
                <li key={s.id} className="timer-other-row">
                  <span className="timer-other-avatar">{s.user_name.charAt(0).toUpperCase()}</span>
                  <span className="timer-other-name">{s.user_name}</span>
                  {s.todo_title && (
                    <span style={{ fontSize: 11, color: '#9699a6' }}>→ {s.todo_title}</span>
                  )}
                  <span className="timer-other-since">since {fmtSince(s.started_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {showClockOut && mySession && (
        <ClockOutDialog
          todoId={mySession.todo_id}
          todoTitle={mySession.todo_title}
          userRole={currentUser?.role ?? null}
          sessionId={mySession.id}
          subtaskOptions={subtaskOptions}
          onConfirm={handleClockOutConfirm}
          onCancel={() => setShowClockOut(false)}
        />
      )}
    </>
  )
}
