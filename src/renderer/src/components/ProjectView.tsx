import { useState, useEffect, useCallback, useRef } from 'react'
import type { Project, Todo, OrgFeatures, TimeSession } from '../../../shared/types'
import FileBrowser from './FileBrowser'
import LinkedMeetings from './LinkedMeetings'
import TimeTab from './TimeTab'
import EditProjectModal from './EditProjectModal'
import TaskGantt from './TaskGantt'
import TodoList from './TodoList'

type MainTab = 'overview' | 'time'

interface Props {
  project: Project
  orgFeatures?: OrgFeatures | null
  defaultTab?: MainTab
  focusTodoId?: number | null
  focusTodoTitle?: string | null
  currentUserId?: number
  onProjectUpdated: () => void
  onProjectDeleted?: () => void
  onProjectArchived?: () => void
}

function ProjectView({ project, orgFeatures, defaultTab, focusTodoId, focusTodoTitle, currentUserId, onProjectUpdated, onProjectDeleted, onProjectArchived }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<MainTab>(defaultTab ?? 'overview')
  const [activeTodo, setActiveTodo] = useState<{ id: number; title: string } | null>(
    focusTodoId ? { id: focusTodoId, title: focusTodoTitle ?? '' } : null
  )
  const [tasks, setTasks] = useState<Todo[]>([])
  const [nasOk, setNasOk] = useState<boolean | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [taskDateWarning, setTaskDateWarning] = useState<string | null>(null)
  const [totalSessionMins, setTotalSessionMins] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const projectDueDate = project.due_date ? new Date(project.due_date) : null
  const projectOverdue = projectDueDate && projectDueDate < new Date()

  // loadTasks must be declared BEFORE handleTaskChanged (TDZ)
  const loadTasks = useCallback(async () => {
    const data = await window.api.todos.list(project.id) as Todo[]
    setTasks(data)
  }, [project.id])

  const checkNas = useCallback(async () => {
    if (!project.nas_path) return
    setNasOk(null)
    const { ok } = await window.api.fs.checkPath(project.nas_path)
    setNasOk(ok)
  }, [project.nas_path])

  const handleTaskChanged = useCallback(async () => {
    await loadTasks()
    if (!project.due_date) return
    const updated = await window.api.todos.list(project.id) as Todo[]
    const exceeding = updated.find((t) => t.due_date && t.due_date > project.due_date!)
    if (exceeding) {
      setTaskDateWarning(
        `Task "${exceeding.title}" has a due date of ${new Date(exceeding.due_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} which is after the project due date. The project due date will need to be updated.`
      )
    }
  }, [loadTasks, project.id, project.due_date])

  useEffect(() => {
    loadTasks()
    checkNas()
  }, [project.id, loadTasks, checkNas])

  useEffect(() => {
    if (!orgFeatures?.time_budgets) { setTotalSessionMins(null); return }
    window.api.time.getSessionsByProject(project.id).then((sessions) => {
      const mins = (sessions as TimeSession[])
        .filter((s) => s.duration_minutes != null)
        .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
      setTotalSessionMins(mins)
    })
  }, [project.id, orgFeatures?.time_budgets])

  const budgetMins = (() => {
    if (!orgFeatures?.time_budgets) return null
    if (project.time_budget_hours) return project.time_budget_hours * 60
    const taskEst = tasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0)
    return taskEst > 0 ? taskEst : null
  })()

  const handleOpenTask = useCallback((todo: Todo) => {
    setActiveTodo({ id: todo.id, title: todo.title })
    setActiveTab('time')
  }, [])

  const menuItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '9px 16px', fontSize: 13, background: 'none',
    border: 'none', cursor: 'pointer', color: '#323338',
  }

  return (
    <div className="project-view">
      {/* Header */}
      <div className="project-header">
        <div className="project-header-left">
          <h1 className="project-title">{project.name}</h1>
          <div className="project-meta-row">
            {project.client_name && (
              <span className="project-client-badge">{project.client_name}</span>
            )}
            <span className={`project-status-badge project-status-${project.status}`}>
              {project.status.replace('_', ' ')}
            </span>
            {project.due_date && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10,
                background: projectOverdue ? '#fdeef1' : '#f0f2f8',
                color: projectOverdue ? '#d83a52' : '#676879',
                border: `1px solid ${projectOverdue ? '#f5b0bc' : '#e6e9f0'}`
              }}>
                {projectOverdue ? '⚠ ' : ''}Due {new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {orgFeatures?.time_budgets && totalSessionMins !== null && (() => {
              const logged = totalSessionMins
              const overBudget = budgetMins !== null && logged > budgetMins
              const pct = budgetMins ? Math.round((logged / budgetMins) * 100) : null
              const fmtMins = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`
              return (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10,
                  background: overBudget ? '#fdeef1' : '#f0f7ff',
                  color: overBudget ? '#d83a52' : '#0073ea',
                  border: `1px solid ${overBudget ? '#f5b0bc' : '#b3d5ff'}`
                }}>
                  ⏱ {fmtMins(logged)}{budgetMins ? ` / ${fmtMins(budgetMins)}${pct !== null ? ` (${pct}%)` : ''}` : ' logged'}
                </span>
              )
            })()}
          </div>
        </div>
        <div className="project-header-actions">
          <button
            className={`main-tab-btn${activeTab === 'overview' ? ' active' : ''}`}
            onClick={() => { setActiveTab('overview'); setActiveTodo(null) }}
          >Overview</button>
          <button
            className={`main-tab-btn${activeTab === 'time' ? ' active' : ''}`}
            onClick={() => setActiveTab('time')}
          >⏱ Time</button>

          {/* Kebab menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              className="btn-edit-project"
              onClick={() => setShowMenu((v) => !v)}
              title="More options"
              style={{ padding: '0 10px', letterSpacing: '0.1em' }}
            >•••</button>
            {showMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                background: '#fff', border: '1px solid #e6e9f0', borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100,
                minWidth: 140, overflow: 'hidden',
              }}>
                <button
                  onClick={() => { setShowMenu(false); setShowEdit(true) }}
                  style={menuItemStyle}
                >Edit project</button>
                {onProjectArchived && (
                  <button
                    onClick={async () => {
                      setShowMenu(false)
                      if (!window.confirm(`Archive "${project.name}"? You can restore it from the archive.`)) return
                      await window.api.projects.archive(project.id)
                      onProjectArchived()
                    }}
                    style={menuItemStyle}
                  >Archive</button>
                )}
                {onProjectDeleted && (
                  <button
                    onClick={async () => {
                      setShowMenu(false)
                      if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return
                      await window.api.projects.delete(project.id)
                      onProjectDeleted()
                    }}
                    style={{ ...menuItemStyle, color: '#d83a52' }}
                  >Delete</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {project.description && (
        <p className="project-description">{project.description}</p>
      )}

      {taskDateWarning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: '#fff8e1', borderBottom: '1px solid #fde68a', fontSize: 12, color: '#92400e', flexShrink: 0 }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{taskDateWarning}</span>
          <button onClick={() => setTaskDateWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: 16, padding: 0 }}>×</button>
        </div>
      )}

      {nasOk === false && (
        <div className="nas-banner">
          <span className="nas-banner-icon">⚠</span>
          <span className="nas-banner-text">
            Folder unreachable: <code>{project.nas_path}</code>
          </span>
          <button className="nas-banner-retry" onClick={checkNas}>Retry</button>
        </div>
      )}

      {/* Time tab */}
      {activeTab === 'time' ? (
        <TimeTab
          projectId={project.id}
          focusTodoId={activeTodo?.id ?? focusTodoId}
          focusTodoTitle={activeTodo?.title ?? focusTodoTitle}
          showOvertimeAlerts={orgFeatures?.overtime_alerts ?? false}
          pauseSplitSessions={orgFeatures?.pause_split_sessions ?? false}
          budgetMins={budgetMins}
        />
      ) : (
        <div className="content-area">
          <div className="phase-content">
            {orgFeatures?.gantt_chart !== false && (
              <TaskGantt tasks={tasks} projectDueDate={project.due_date} />
            )}

            {/* Meetings */}
            <LinkedMeetings projectId={project.id} nasPath={project.nas_path} />

            {/* Flat task list */}
            <div className="phase-cards-section">
              <TodoList
                projectId={project.id}
                timeBudgets={!!orgFeatures?.time_budgets}
                nasPath={project.nas_path ?? undefined}
                onChanged={handleTaskChanged}
                onTasksChanged={setTasks}
                onOpenTask={handleOpenTask}
              />
            </div>
          </div>

          <FileBrowser nasPath={project.nas_path} projectId={project.id} currentUserId={currentUserId ?? 0} />
        </div>
      )}

      {showEdit && (
        <EditProjectModal
          project={project}
          timeBudgets={!!orgFeatures?.time_budgets}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onProjectUpdated() }}
        />
      )}
    </div>
  )
}

export default ProjectView
