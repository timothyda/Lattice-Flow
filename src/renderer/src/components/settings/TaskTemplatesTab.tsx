import { useState, useEffect, useCallback } from 'react'
import type { TaskTemplate, Organization, User, ProjectType } from '../../../../shared/types'
import { PROJECT_TYPE_LABELS } from '../../../../shared/types'

interface Props {
  org: Organization
  currentUser: User | null
}

const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS).filter((t) => t !== 'other') as ProjectType[]

const canEdit = (role: string | undefined) =>
  role === 'admin' || role === 'project_manager' || role === 'lead_designer'

export default function TaskTemplatesTab({ org, currentUser }: Props): JSX.Element {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [activeType, setActiveType] = useState<ProjectType>('website')
  const [newSubtask, setNewSubtask] = useState<Record<number, string>>({})
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [loading, setLoading] = useState(true)

  const editable = canEdit(currentUser?.role)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await window.api.taskTemplates.list(org.id)
    setTemplates(data)
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const visibleTemplates = templates.filter((t) => t.project_type === activeType)

  const handleAddSubtask = async (templateId: number) => {
    const title = (newSubtask[templateId] ?? '').trim()
    if (!title) return
    await window.api.taskTemplates.addSubtask(templateId, title)
    setNewSubtask((prev) => ({ ...prev, [templateId]: '' }))
    await load()
  }

  const handleRemoveSubtask = async (id: number) => {
    await window.api.taskTemplates.removeSubtask(id)
    await load()
  }

  const handleAddTemplate = async () => {
    const title = newTaskTitle.trim()
    if (!title) return
    await window.api.taskTemplates.addTemplate(org.id, activeType, title)
    setNewTaskTitle('')
    await load()
  }

  const handleRemoveTemplate = async (id: number) => {
    if (!window.confirm('Remove this task and all its subtasks?')) return
    await window.api.taskTemplates.removeTemplate(id)
    await load()
  }

  if (loading) {
    return <p style={{ color: '#9699a6', fontSize: 13 }}>Loading…</p>
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#676879', marginBottom: 16, lineHeight: 1.6 }}>
        These templates define the tasks and subtask options auto-generated when creating a new project, and available in the time-logging subtask dropdown.
        {!editable && ' Only admins, project managers, and lead designers can edit templates.'}
      </p>

      {/* Project type tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {PROJECT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              border: '1.5px solid',
              borderColor: activeType === type ? '#0073ea' : '#c3c6d4',
              background: activeType === type ? '#e6f2ff' : '#fff',
              color: activeType === type ? '#0073ea' : '#676879',
              fontWeight: activeType === type ? 600 : 400,
            }}
          >
            {PROJECT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visibleTemplates.map((tpl) => (
          <div key={tpl.id} style={{ border: '1px solid #e6e9f0', borderRadius: 8, padding: '12px 14px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#323338' }}>{tpl.title}</span>
              {editable && (
                <button
                  onClick={() => handleRemoveTemplate(tpl.id)}
                  style={{ background: 'none', border: 'none', color: '#c3c6d4', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                  title="Remove task"
                >×</button>
              )}
            </div>

            {/* Subtag chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: editable ? 8 : 0 }}>
              {tpl.subtasks.map((sub) => (
                <span
                  key={sub.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#f0f2f8', borderRadius: 20, padding: '3px 10px',
                    fontSize: 11, color: '#323338',
                  }}
                >
                  {sub.title}
                  {editable && (
                    <button
                      onClick={() => handleRemoveSubtask(sub.id)}
                      style={{ background: 'none', border: 'none', color: '#9699a6', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}
                    >×</button>
                  )}
                </span>
              ))}
              {tpl.subtasks.length === 0 && (
                <span style={{ fontSize: 11, color: '#9699a6', fontStyle: 'italic' }}>No subtasks</span>
              )}
            </div>

            {/* Add subtask input */}
            {editable && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Add subtask…"
                  value={newSubtask[tpl.id] ?? ''}
                  onChange={(e) => setNewSubtask((prev) => ({ ...prev, [tpl.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask(tpl.id)}
                  style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid #c3c6d4', borderRadius: 6 }}
                />
                <button
                  onClick={() => handleAddSubtask(tpl.id)}
                  disabled={!(newSubtask[tpl.id] ?? '').trim()}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#0073ea', border: 'none', color: '#fff', cursor: 'pointer' }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add task */}
      {editable && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <input
            type="text"
            placeholder={`Add task to ${PROJECT_TYPE_LABELS[activeType]} template…`}
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTemplate()}
            style={{ flex: 1, fontSize: 12, padding: '6px 10px', border: '1px solid #c3c6d4', borderRadius: 6 }}
          />
          <button
            onClick={handleAddTemplate}
            disabled={!newTaskTitle.trim()}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, background: '#0073ea', border: 'none', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Add Task
          </button>
        </div>
      )}
    </div>
  )
}
