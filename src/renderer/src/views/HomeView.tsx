import { useState, useEffect, useCallback } from 'react'
import type { User, AuthUser, Organization, Todo, RecentFile } from '../../../shared/types'

const TASK_STATUS_LABELS: Record<string, string> = {
  planning:'Planning', ready_for_design:'Ready for Design', ready_for_review:'Ready for Review',
  need_it:'Need IT', hold:'On Hold', in_progress:'In Progress', complete:'Complete',
}
const TASK_STATUS_COLORS: Record<string, string> = {
  planning:'#676879', ready_for_design:'#0073ea', ready_for_review:'#9f57f7',
  need_it:'#ff7b00', hold:'#e2445c', in_progress:'#00c875', complete:'#00854d',
}

interface Props {
  currentUser: User | null
  authUser: AuthUser | null
  org: Organization
  onLogin: () => void
  onOpenTask: (todo: Todo) => void
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return '🖼'
  if (['pdf'].includes(ext)) return '📄'
  if (['doc','docx'].includes(ext)) return '📝'
  if (['xls','xlsx','csv'].includes(ext)) return '📊'
  if (['mp4','mov','avi','mkv'].includes(ext)) return '🎬'
  if (['mp3','wav','m4a'].includes(ext)) return '🎵'
  if (['zip','rar','7z'].includes(ext)) return '🗜'
  return '📁'
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr.replace(' ','T')+'Z')
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isOverdue(due: string | null): boolean {
  if (!due) return false
  return new Date(due) < new Date()
}

function StatusChip({ status }: { status: string }): JSX.Element {
  const label = TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] ?? status
  const color = TASK_STATUS_COLORS[status as keyof typeof TASK_STATUS_COLORS] ?? '#676879'
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px',
      borderRadius: 8, color, background: `${color}18`,
      border: `1px solid ${color}33`, whiteSpace: 'nowrap', flexShrink: 0
    }}>
      {label}
    </span>
  )
}

function TaskItem({ todo, onClick }: { todo: Todo; onClick: () => void }): JSX.Element {
  return (
    <div
      className="home-task-item"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      title="Click to open in project time tab"
    >
      <div className="home-task-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div className="home-task-title">{todo.title}</div>
          <StatusChip status={todo.task_status} />
        </div>
        <div className="home-task-meta">
          {todo.project_name && (
            <span className="home-task-project">{todo.project_name}</span>
          )}
          {todo.due_date && (
            <span className={`home-task-due${isOverdue(todo.due_date) ? ' overdue' : ''}`}>
              {isOverdue(todo.due_date) ? '⚠ ' : ''}Due {new Date(todo.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#c3c6d4' }}>{relativeTime(todo.updated_at)}</span>
        </div>
      </div>
    </div>
  )
}

export default function HomeView({ currentUser, authUser, org, onLogin, onOpenTask }: Props): JSX.Element {
  const [myOpenTodos, setMyOpenTodos] = useState<Todo[]>([])
  const [completedTodos, setCompletedTodos] = useState<Todo[]>([])
  const [allOpenTodos, setAllOpenTodos] = useState<Todo[]>([])
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentUser) { setLoading(false); return }
    setLoading(true)
    try {
      const [myOpen, completed, allOpen, files] = await Promise.all([
        window.api.todos.openForUser(currentUser.id) as Promise<Todo[]>,
        window.api.todos.completedForUser(currentUser.id, 30) as Promise<Todo[]>,
        window.api.todos.allOpenOrg(org.id) as Promise<Todo[]>,
        window.api.recentFiles.list(currentUser.id, 8) as Promise<RecentFile[]>
      ])
      setMyOpenTodos(myOpen)
      setCompletedTodos(completed)
      setAllOpenTodos(allOpen)
      setRecentFiles(files)
    } finally {
      setLoading(false)
    }
  }, [currentUser, org.id])

  useEffect(() => { load() }, [load])

  const greeting = (): string => {
    const h = new Date().getHours()
    const name = currentUser?.display_name?.split(' ')[0] ?? authUser?.name?.split(' ')[0] ?? 'there'
    if (h < 12) return `Good morning, ${name}`
    if (h < 17) return `Good afternoon, ${name}`
    return `Good evening, ${name}`
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  if (!authUser && !currentUser) {
    return (
      <div className="home-view" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>👋</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#323338' }}>Welcome to {org.name}</div>
          <div style={{ fontSize: 14, color: '#676879' }}>Sign in with Microsoft to see your dashboard.</div>
          <button className="btn-primary" style={{ marginTop: 8 }} onClick={onLogin}>
            🪟 Sign in with Microsoft
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-view">
      <div className="home-header">
        <div>
          <div className="home-greeting">{greeting()}</div>
          <div className="home-date">{today}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#9699a6', fontSize: 13, padding: '20px 0' }}>Loading your dashboard…</div>
      ) : (
        <div className="home-widgets">

          {/* My Open Tasks */}
          <div className="widget-card">
            <div className="widget-card-header">
              <span className="widget-card-icon">📌</span>
              <span className="widget-card-title">My Open Tasks</span>
              <span className="widget-card-count">{myOpenTodos.length}</span>
            </div>
            <div className="widget-card-body">
              {myOpenTodos.length === 0 ? (
                <div className="widget-empty">No tasks assigned to you — you're all caught up! 🎉</div>
              ) : (
                myOpenTodos.map((todo) => (
                  <TaskItem key={todo.id} todo={todo} onClick={() => onOpenTask(todo)} />
                ))
              )}
            </div>
          </div>

          {/* Recently Completed */}
          <div className="widget-card">
            <div className="widget-card-header">
              <span className="widget-card-icon">🏁</span>
              <span className="widget-card-title">Recently Completed</span>
              <span className="widget-card-count">{completedTodos.length}</span>
            </div>
            <div className="widget-card-body">
              {completedTodos.length === 0 ? (
                <div className="widget-empty">No completed tasks in the last 30 days</div>
              ) : (
                completedTodos.map((todo) => (
                  <div key={todo.id} className="home-task-item">
                    <div className="home-task-check done" title="Completed">✓</div>
                    <div className="home-task-body">
                      <div className="home-task-title done">{todo.title}</div>
                      <div className="home-task-meta">
                        {todo.project_name && <span className="home-task-project">{todo.project_name}</span>}
                        {todo.completed_at && (
                          <span className="home-task-due">{relativeTime(todo.completed_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* All Open Tasks (org-wide, newest first) */}
          <div className="widget-card" style={{ gridColumn: 'span 2' }}>
            <div className="widget-card-header">
              <span className="widget-card-icon">📋</span>
              <span className="widget-card-title">All Open Tasks</span>
              <span className="widget-card-count">{allOpenTodos.length}</span>
            </div>
            <div className="widget-card-body" style={{ maxHeight: 320 }}>
              {allOpenTodos.length === 0 ? (
                <div className="widget-empty">No open tasks across the organization</div>
              ) : (
                allOpenTodos.map((todo) => (
                  <TaskItem key={todo.id} todo={todo} onClick={() => onOpenTask(todo)} />
                ))
              )}
            </div>
          </div>

          {/* Recent Files */}
          <div className="widget-card">
            <div className="widget-card-header">
              <span className="widget-card-icon">📂</span>
              <span className="widget-card-title">Recent Files</span>
            </div>
            <div className="widget-card-body">
              {recentFiles.length === 0 ? (
                <div className="widget-empty">No recently accessed files</div>
              ) : (
                recentFiles.map((file) => (
                  <div key={file.id} className="home-file-item">
                    <span className="home-file-icon">{fileIcon(file.file_name)}</span>
                    <div className="home-file-info">
                      <div className="home-file-name">{file.file_name}</div>
                      <div className="home-file-meta">
                        {file.project_name} · {relativeTime(file.accessed_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
