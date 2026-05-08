import { useState } from 'react'
import type { Organization, User, ProjectType } from '../../../../shared/types'
import { PROJECT_TYPE_LABELS } from '../../../../shared/types'

interface Props {
  org: Organization
  clientId: number
  currentUser: User | null
  onClose: () => void
  onCreated: (id: number) => void
}

function NewProjectModal({ org, clientId, currentUser, onClose, onCreated }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectType, setProjectType] = useState<ProjectType>('other')
  const [dueDate, setDueDate] = useState('')
  const [nasPath, setNasPath] = useState('')
  const [pathOk, setPathOk] = useState<boolean | null>(null)
  const [pathChecking, setPathChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBrowse = async () => {
    const folder = await window.api.dialog.pickFolder()
    if (folder) {
      setNasPath(folder)
      checkPath(folder)
    }
  }

  const checkPath = async (path: string) => {
    if (!path.trim()) { setPathOk(null); return }
    setPathChecking(true)
    const result = await window.api.fs.checkPath(path)
    setPathOk(result.ok)
    setPathChecking(false)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const project = await window.api.projects.create({
        organization_id: org.id,
        client_id: clientId,
        name: name.trim(),
        description: description.trim(),
        nas_path: nasPath.trim(),
        due_date: dueDate || null,
        project_type: projectType
      }) as { id: number }

      // Auto-create Meeting Recordings folder if path is set
      if (nasPath.trim() && pathOk) {
        const recPath = window.api.path.join(nasPath.trim(), 'Meeting Recordings')
        await window.api.fs.mkdir(recPath).catch(() => { /* non-fatal */ })
      }

      onCreated(project.id)
    } catch (err) {
      setError('Failed to create project. Please try again.')
      console.error('[NewProjectModal]', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">New Project</div>

        <div className="field">
          <label>Project name</label>
          <input
            type="text"
            placeholder="e.g. Website Redesign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Project type</label>
          <select value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)}>
            {(Object.entries(PROJECT_TYPE_LABELS) as [ProjectType, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {projectType !== 'other' && (
            <div className="field-hint">Tasks will be auto-generated from the {PROJECT_TYPE_LABELS[projectType]} template.</div>
          )}
        </div>

        <div className="field">
          <label>Description <span className="field-optional">(optional)</span></label>
          <textarea
            rows={2}
            placeholder="Brief project description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Due date <span className="field-optional">(optional)</span></label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="field">
          <label>
            Project folder <span className="field-optional">(optional)</span>
          </label>
          <div className="path-row">
            <input
              type="text"
              placeholder="C:\Projects\..."
              value={nasPath}
              onChange={(e) => { setNasPath(e.target.value); setPathOk(null) }}
              onBlur={() => checkPath(nasPath)}
            />
            <button className="btn-browse" onClick={handleBrowse}>Browse</button>
          </div>
          {nasPath && !pathChecking && (
            <div className={`field-hint${pathOk ? ' field-hint-ok' : ''}`}>
              {pathOk ? '✓ Folder found' : '⚠ Folder not found — it will be linked anyway'}
            </div>
          )}
          {pathChecking && <div className="field-hint">Checking…</div>}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewProjectModal
