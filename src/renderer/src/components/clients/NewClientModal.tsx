import { useState } from 'react'
import type { Organization } from '../../../../shared/types'

interface Props {
  org: Organization
  onClose: () => void
  onCreated: () => void
}

function NewClientModal({ org, onClose, onCreated }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Client name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      await window.api.clients.create({
        organization_id: org.id,
        name: name.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_role: contactRole.trim() || null,
        notes: notes.trim() || null,
        description: null,
        logo_url: null,
      })
      onCreated()
    } catch (err) {
      setError('Failed to create client. Please try again.')
      console.error('[NewClientModal]', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Add Client</div>

        <div className="field">
          <label>Client name</label>
          <input
            type="text"
            placeholder="e.g. Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Contact name <span className="field-optional">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. Jane Smith"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Contact role <span className="field-optional">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. Marketing Director"
            value={contactRole}
            onChange={(e) => setContactRole(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Contact email <span className="field-optional">(optional)</span></label>
          <input
            type="email"
            placeholder="e.g. jane@acme.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Notes <span className="field-optional">(optional)</span></label>
          <textarea
            rows={3}
            placeholder="Any additional notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewClientModal
