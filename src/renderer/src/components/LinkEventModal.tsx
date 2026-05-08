import { useState } from 'react'
import type { CalendarEvent, Project } from '../../../shared/types'

interface Props {
  event: CalendarEvent
  projects: Project[]
  onClose: () => void
  onLinked: () => void
}

export default function LinkEventModal({ event, projects, onClose, onLinked }: Props): JSX.Element {
  const [projectId, setProjectId] = useState<number>(projects[0]?.id ?? 0)
  const [title, setTitle] = useState(event.title)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) { setError('Select a project'); return }
    setLoading(true)
    try {
      await window.api.meetings.create({
        project_id: projectId,
        title: title.trim() || event.title,
        date: event.start,
        recording_path: null,
        calendar_event_id: event.id,
        notes: null
      })
      onLinked()
    } catch {
      setError('Failed to link event — please try again.')
      setLoading(false)
    }
  }

  const eventDate = new Date(event.start).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Link to Project</h3>

        <div className="ev-modal-event">
          <div className="ev-modal-subject">{event.title}</div>
          <div className="ev-modal-date">{eventDate}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Meeting Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.client_name ? ` — ${p.client_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !projects.length}>
              {loading ? 'Linking…' : 'Link Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
