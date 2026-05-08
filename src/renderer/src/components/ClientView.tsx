import { useState, useEffect, useCallback } from 'react'
import type { Client, Project, ClientContact, NewClientContact } from '../../../shared/types'

interface Props {
  client: Client
  projects: Project[]
  onClientUpdated: (updated: Client) => void
  onProjectSelect: (projectId: number) => void
}

function clientSince(createdAt: string): string {
  const created = new Date(createdAt.replace(' ', 'T') + (createdAt.includes('T') ? '' : 'Z'))
  const now = new Date()
  const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth())
  const years = Math.floor(months / 12)
  const rem = months % 12
  const since = created.toLocaleDateString([], { month: 'long', year: 'numeric' })
  if (months < 1) return `Since ${since} (less than a month)`
  if (years === 0) return `Since ${since} (${months} month${months !== 1 ? 's' : ''})`
  const yearStr = `${years} year${years !== 1 ? 's' : ''}`
  const monStr = rem > 0 ? ` ${rem} month${rem !== 1 ? 's' : ''}` : ''
  return `Since ${since} (${yearStr}${monStr})`
}

export default function ClientView({ client, projects, onClientUpdated, onProjectSelect }: Props): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(client.name)
  const [description, setDescription] = useState(client.description ?? '')
  const [notes, setNotes] = useState(client.notes ?? '')
  const [contactName, setContactName] = useState(client.contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(client.contact_email ?? '')
  const [contactRole, setContactRole] = useState(client.contact_role ?? '')
  const [logoUrl, setLogoUrl] = useState(client.logo_url ?? '')
  const [saving, setSaving] = useState(false)

  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [newContactName, setNewContactName] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [newContactRole, setNewContactRole] = useState('')
  const [addingContact, setAddingContact] = useState(false)

  const loadContacts = useCallback(async () => {
    const data = await window.api.clientContacts.list(client.id)
    setContacts(data)
  }, [client.id])

  useEffect(() => {
    setName(client.name)
    setDescription(client.description ?? '')
    setNotes(client.notes ?? '')
    setContactName(client.contact_name ?? '')
    setContactEmail(client.contact_email ?? '')
    setContactRole(client.contact_role ?? '')
    setLogoUrl(client.logo_url ?? '')
    setEditing(false)
    loadContacts()
  }, [client.id, loadContacts])

  const handleSave = async () => {
    setSaving(true)
    const updated = await window.api.clients.update(client.id, {
      name: name.trim() || client.name,
      description: description.trim() || null,
      notes: notes.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_role: contactRole.trim() || null,
      logo_url: logoUrl.trim() || null,
    })
    if (updated) {
      const c = updated as Client
      onClientUpdated(c)
      // Sync local state from DB response so fields reflect what was saved
      setName(c.name)
      setDescription(c.description ?? '')
      setNotes(c.notes ?? '')
      setContactName(c.contact_name ?? '')
      setContactEmail(c.contact_email ?? '')
      setContactRole(c.contact_role ?? '')
      setLogoUrl(c.logo_url ?? '')
    }
    setSaving(false)
    setEditing(false)
  }

  const handlePickLogo = async () => {
    const files = await window.api.dialog.pickFiles()
    if (files[0]) setLogoUrl(files[0])
  }

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactEmail.trim()) return
    const data: NewClientContact = {
      client_id: client.id,
      name: newContactName.trim(),
      email: newContactEmail.trim(),
      role: newContactRole.trim() || null,
    }
    await window.api.clientContacts.create(data)
    setNewContactName('')
    setNewContactEmail('')
    setNewContactRole('')
    setAddingContact(false)
    await loadContacts()
  }

  const handleDeleteContact = async (id: number) => {
    if (!window.confirm('Remove this contact?')) return
    await window.api.clientContacts.delete(id)
    await loadContacts()
  }

  const activeProjects = projects.filter((p) => p.status === 'active' || p.status === 'on_hold')
  const allProjects = projects.filter((p) => p.status !== 'archived')

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{ padding: '32px 40px', maxWidth: 860, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 32 }}>

        {/* Logo */}
        <div
          onClick={editing ? handlePickLogo : undefined}
          style={{
            width: 80, height: 80, borderRadius: 14, flexShrink: 0,
            background: '#f0f2f8', border: '1.5px solid #e6e9f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', cursor: editing ? 'pointer' : 'default',
            position: 'relative',
          }}
          title={editing ? 'Click to pick logo image' : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl.startsWith('/') || logoUrl.match(/^[A-Za-z]:\\/) ? `file:///${logoUrl.replace(/\\/g, '/')}` : logoUrl}
              alt={client.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <span style={{ fontSize: 32, userSelect: 'none' }}>
              {client.name.charAt(0).toUpperCase()}
            </span>
          )}
          {editing && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 14,
            }}>
              <span style={{ fontSize: 11, color: '#fff', textAlign: 'center', padding: '0 6px' }}>Change logo</span>
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: 24, fontWeight: 700, width: '100%', border: '1.5px solid #0073ea', borderRadius: 8, padding: '4px 10px', marginBottom: 6 }}
            />
          ) : (
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#323338', margin: '0 0 4px' }}>{client.name}</h1>
          )}
          <div style={{ fontSize: 13, color: '#676879' }}>{clientSince(client.created_at)}</div>
          <div style={{ marginTop: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
              background: client.status === 'active' ? '#e6f9f0' : '#fff4e6',
              color: client.status === 'active' ? '#00854d' : '#ff7b00',
              border: `1px solid ${client.status === 'active' ? '#b3e0c8' : '#ffd0a0'}`,
            }}>
              {client.status === 'active' ? 'Active' : client.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {editing ? (
            <>
              <button className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* ── Description ── */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Section title="About">
            {editing ? (
              <textarea
                rows={3}
                placeholder="Describe this client — industry, background, relationship…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', resize: 'vertical', fontSize: 13, padding: '8px 10px', border: '1px solid #c3c6d4', borderRadius: 8, fontFamily: 'inherit' }}
              />
            ) : (
              <p style={{ fontSize: 13, color: description ? '#323338' : '#9699a6', lineHeight: 1.6, margin: 0, fontStyle: description ? 'normal' : 'italic' }}>
                {description || 'No description yet.'}
              </p>
            )}
          </Section>
        </div>

        {/* ── Primary Contact ── */}
        <Section title="Primary Contact">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                placeholder="Contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #c3c6d4', borderRadius: 8 }}
              />
              <input
                type="text"
                placeholder="Contact role (e.g. Marketing Director)"
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #c3c6d4', borderRadius: 8 }}
              />
              <input
                type="email"
                placeholder="Contact email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #c3c6d4', borderRadius: 8 }}
              />
            </div>
          ) : (
            <div>
              {client.contact_name ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#323338' }}>{client.contact_name}</div>
                  {client.contact_role && (
                    <div style={{ fontSize: 11, color: '#676879', marginTop: 1 }}>{client.contact_role}</div>
                  )}
                  {client.contact_email && (
                    <a href={`mailto:${client.contact_email}`} style={{ fontSize: 13, color: '#0073ea', display: 'block', marginTop: 2 }}>{client.contact_email}</a>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 13, color: '#9699a6', fontStyle: 'italic' }}>No primary contact set.</span>
              )}
            </div>
          )}
        </Section>

        {/* ── Notes ── */}
        <Section title="Notes">
          {editing ? (
            <textarea
              rows={3}
              placeholder="Internal notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', resize: 'vertical', fontSize: 13, padding: '8px 10px', border: '1px solid #c3c6d4', borderRadius: 8, fontFamily: 'inherit' }}
            />
          ) : (
            <p style={{ fontSize: 13, color: notes ? '#323338' : '#9699a6', lineHeight: 1.6, margin: 0, fontStyle: notes ? 'normal' : 'italic' }}>
              {notes || 'No notes.'}
            </p>
          )}
        </Section>

        {/* ── Additional Contacts ── */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Section
            title="Contacts"
            action={
              <button
                onClick={() => setAddingContact((v) => !v)}
                style={{ fontSize: 12, color: '#0073ea', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                {addingContact ? 'Cancel' : '+ Add Contact'}
              </button>
            }
          >
            {contacts.length === 0 && !addingContact && (
              <p style={{ fontSize: 13, color: '#9699a6', fontStyle: 'italic', margin: 0 }}>No additional contacts yet.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contacts.map((c) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: '#f8f9fb', borderRadius: 8, padding: '10px 14px',
                  border: '1px solid #e6e9f0',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: '#e6f2ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600, color: '#0073ea', flexShrink: 0,
                  }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#323338' }}>
                      {c.name}
                      {c.role && <span style={{ fontSize: 11, color: '#676879', fontWeight: 400, marginLeft: 8 }}>{c.role}</span>}
                    </div>
                    <a href={`mailto:${c.email}`} style={{ fontSize: 12, color: '#0073ea' }}>{c.email}</a>
                  </div>
                  <button
                    onClick={() => handleDeleteContact(c.id)}
                    style={{ background: 'none', border: 'none', color: '#c3c6d4', cursor: 'pointer', fontSize: 16, padding: 4 }}
                    title="Remove contact"
                  >×</button>
                </div>
              ))}

              {addingContact && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end', background: '#f0f2f8', borderRadius: 8, padding: 12 }}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    autoFocus
                    style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #c3c6d4', borderRadius: 6 }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #c3c6d4', borderRadius: 6 }}
                  />
                  <input
                    type="text"
                    placeholder="Role (optional)"
                    value={newContactRole}
                    onChange={(e) => setNewContactRole(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddContact()}
                    style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #c3c6d4', borderRadius: 6 }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleAddContact}
                    disabled={!newContactName.trim() || !newContactEmail.trim()}
                    style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* ── Projects ── */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Section title={`Projects (${allProjects.length})`}>
            {allProjects.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9699a6', fontStyle: 'italic', margin: 0 }}>No projects yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {allProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onProjectSelect(p.id)}
                    style={{
                      textAlign: 'left', padding: '14px 16px', borderRadius: 10,
                      border: '1.5px solid #e6e9f0', background: '#fff',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0073ea'; e.currentTarget.style.background = '#f0f7ff' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e6e9f0'; e.currentTarget.style.background = '#fff' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#323338', marginBottom: 4 }}>{p.name}</div>
                    <StatusPill status={p.status} />
                    {p.due_date && (
                      <div style={{ fontSize: 11, color: '#9699a6', marginTop: 6 }}>
                        Due {new Date(p.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>

      </div>
    </div>
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e6e9f0', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#676879', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active:    { label: 'Active',    bg: '#e6f9f0', color: '#00854d' },
    on_hold:   { label: 'On Hold',   bg: '#fff4e6', color: '#ff7b00' },
    complete:  { label: 'Complete',  bg: '#e6f2ff', color: '#0073ea' },
    archived:  { label: 'Archived',  bg: '#f0f2f8', color: '#676879' },
  }
  const s = map[status] ?? { label: status, bg: '#f0f2f8', color: '#676879' }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}
