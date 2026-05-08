import { useState } from 'react'
import type { Project, ProjectStatus } from '../../../shared/types'

interface Props {
  project: Project
  onClose: () => void
  onSaved: () => void
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active',   label: 'Active' },
  { value: 'on_hold',  label: 'On Hold' },
  { value: 'complete', label: 'Complete' },
  { value: 'archived', label: 'Archived' },
]

function sanitizeName(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*]/g, '_') || 'Project'
}

function EditProjectModal({ project, onClose, onSaved }: Props): JSX.Element {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [dueDate, setDueDate] = useState(project.due_date ?? '')
  const [nasPath, setNasPath] = useState(project.nas_path)
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [rootFolder, setRootFolder] = useState('')
  const [pathFixed, setPathFixed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleBrowse = async () => {
    const root = await window.api.dialog.pickFolder()
    if (!root) return
    setRootFolder(root)
    const sub = sanitizeName(name)
    setNasPath(window.api.path.join(root, sub))
  }

  const handleFixPath = async () => {
    const fixedPath = window.api.path.join(project.nas_path, sanitizeName(name))
    await window.api.fs.mkdir(fixedPath)
    setNasPath(fixedPath)
    setRootFolder(project.nas_path)
    setPathFixed(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required.'); return }
    setLoading(true)
    try {
      if (rootFolder) {
        await window.api.fs.mkdir(nasPath)
        await window.api.fs.mkdir(window.api.path.join(nasPath, 'Meeting Recordings'))
      }
      await window.api.projects.update(project.id, { name: name.trim(), description, nas_path: nasPath, status, due_date: dueDate || null })
      onSaved()
    } catch {
      setError('Failed to save changes. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Edit Project</h3>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Project Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brand Refresh" />
          </div>

          <div className="field">
            <label>Due date <span className="field-optional">(optional)</span></label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Description <span className="field-optional">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project…"
              rows={3}
            />
          </div>

          <div className="field">
            <label>Project Folder</label>
            <div className="path-row">
              <input
                value={nasPath}
                onChange={(e) => { setRootFolder(''); setNasPath(e.target.value) }}
                readOnly={!!rootFolder}
              />
              <button type="button" className="btn-browse" onClick={handleBrowse}>Browse…</button>
            </div>
            {rootFolder && !pathFixed && (
              <p className="field-hint">
                Folder <strong>{sanitizeName(name)}</strong> will be created inside the selected location.
              </p>
            )}
            {pathFixed && <p className="field-hint field-hint-ok">✓ Project subfolder created — save to apply.</p>}
            {!rootFolder && !pathFixed && (
              <button type="button" className="btn-fix-path" onClick={handleFixPath}>
                Fix: create project subfolder inside current path
              </button>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditProjectModal
