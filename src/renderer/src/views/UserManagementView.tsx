import { useState, useEffect, useCallback } from 'react'
import type { User, UserRole, Organization } from '../../../shared/types'

interface Props {
  org: Organization
  currentUser: User | null
}

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin',             label: 'Admin',             desc: 'Full access, org settings, user management' },
  { value: 'project_manager',   label: 'Project Manager',   desc: 'Full project access, team oversight' },
  { value: 'creative_director', label: 'Creative Director', desc: 'Creative oversight, team management' },
  { value: 'lead_designer',     label: 'Lead Designer',     desc: 'Project tasks, time tracking, files' },
  { value: 'senior_designer',   label: 'Senior Designer',   desc: 'Project tasks, time tracking, files' },
  { value: 'junior_designer',   label: 'Junior Designer',   desc: 'Project tasks, time tracking, files' },
  { value: 'designer',          label: 'Designer',          desc: 'Project tasks, time tracking, files' },
  { value: 'senior_developer',  label: 'Senior Developer',  desc: 'Development tasks, time tracking' },
  { value: 'junior_developer',  label: 'Junior Developer',  desc: 'Development tasks, time tracking' },
  { value: 'marketing',         label: 'Marketing',         desc: 'Project tasks, time tracking' },
  { value: 'account_manager',   label: 'Account Manager',   desc: 'Client relations, project visibility' },
  { value: 'sales',             label: 'Sales',             desc: 'Project visibility, client contact' },
  { value: 'it',                label: 'IT',                desc: 'Technical tasks, time tracking' },
]

function roleLabel(r: UserRole): string {
  return ROLES.find((x) => x.value === r)?.label ?? r
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

// ── Invite code display modal ─────────────────────────────────────────────────

function InviteCodeModal({ name, email, code, onClose }: {
  name: string
  email: string
  code: string
  onClose: () => void
}): JSX.Element {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title">Invite Code for {name}</div>
        <p style={{ fontSize: 13, color: '#676879', marginBottom: 16 }}>
          Share this code with <strong>{email}</strong>. They'll enter it when they first sign in to set their password. The code expires in 7 days.
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#f0f2f8', borderRadius: 8, padding: '10px 14px'
        }}>
          <code style={{ flex: 1, fontSize: 14, letterSpacing: 1, color: '#323338', wordBreak: 'break-all' }}>
            {code}
          </code>
          <button
            onClick={copy}
            style={{ background: '#0073ea', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Recovery code modal ───────────────────────────────────────────────────────

function RecoveryCodeModal({ code, onClose }: { code: string; onClose: () => void }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-title">Your Recovery Code</div>
        <p style={{ fontSize: 13, color: '#676879', marginBottom: 16, lineHeight: 1.6 }}>
          Save this code somewhere safe (password manager, printed paper, etc). If you ever forget your password, this is the only way back in.
          <strong style={{ color: '#d83a52' }}> It will not be shown again.</strong>
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0f2f8', borderRadius: 8, padding: '12px 16px' }}>
          <code style={{ flex: 1, fontSize: 14, letterSpacing: 2, color: '#323338', wordBreak: 'break-all', fontFamily: 'monospace' }}>
            {code}
          </code>
          <button onClick={copy}
            style={{ background: '#0073ea', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Add member modal ──────────────────────────────────────────────────────────

function AddUserModal({ org, onClose, onAdded }: {
  org: Organization
  onClose: () => void
  onAdded: (name: string, email: string, code: string) => void
}): JSX.Element {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('designer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!displayName.trim()) { setError('Name is required.'); return }
    if (!email.trim() || !email.includes('@')) { setError('Valid email is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const result = await window.api.users.createInvited({
        organization_id: org.id,
        display_name: displayName.trim(),
        email: email.trim().toLowerCase(),
        role
      })
      if (!result) { setError('Failed to add user. Please try again.'); return }
      onAdded(displayName.trim(), email.trim().toLowerCase(), result.inviteToken)
    } catch (err) {
      setError('Failed to add user. Please try again.')
      console.error('[AddUserModal]', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Add Team Member</div>

        <div className="field">
          <label>Full name</label>
          <input
            type="text"
            placeholder="e.g. Jane Smith"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Email address</label>
          <input
            type="email"
            placeholder="e.g. jane@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="field-hint">An invite code will be generated for them to set their password.</div>
        </div>

        <div className="field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
            ))}
          </select>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={saving || !displayName.trim() || !email.trim()}
          >
            {saving ? 'Adding…' : 'Add & Get Invite Code'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function UserManagementView({ org, currentUser }: Props): JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [inviteModal, setInviteModal] = useState<{ name: string; email: string; code: string } | null>(null)
  const [recoveryModal, setRecoveryModal] = useState<string | null>(null)
  const [generatingRecovery, setGeneratingRecovery] = useState(false)

  const isAdmin = currentUser?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    const data = await window.api.users.list(org.id) as User[]
    setUsers(data)
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    if (!isAdmin) return
    setUpdatingId(userId)
    await window.api.users.update(userId, { role: newRole })
    await load()
    setUpdatingId(null)
  }

  const handleDelete = async (user: User) => {
    if (!isAdmin) return
    if (user.id === currentUser?.id) { alert("You can't remove yourself."); return }
    if (!window.confirm(`Remove ${user.display_name} from the organization?`)) return
    await window.api.users.delete(user.id)
    await load()
  }

  const handleRegenerateInvite = async (user: User) => {
    if (!isAdmin) return
    const code = await window.api.auth.generateInvite(user.id)
    if (code) setInviteModal({ name: user.display_name, email: user.email, code })
  }

  const handleGenerateRecovery = async () => {
    setGeneratingRecovery(true)
    try {
      const code = await window.api.auth.generateRecovery()
      if (code) setRecoveryModal(code)
    } finally {
      setGeneratingRecovery(false)
    }
  }

  const isPending = (u: User) => u.must_set_password === 1

  return (
    <div className="user-mgmt-view">
      <div className="user-mgmt-header">
        <span className="user-mgmt-title">Team Members</span>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            + Add Member
          </button>
        )}
      </div>

      {!isAdmin && (
        <p style={{ color: '#676879', fontSize: 13, marginBottom: 16 }}>
          Only admins can manage team members.
        </p>
      )}

      <div style={{ marginBottom: 12, fontSize: 13, color: '#676879' }}>
        <strong style={{ color: '#323338' }}>{users.length}</strong> member{users.length !== 1 ? 's' : ''} in {org.name}
      </div>

      {loading ? (
        <p style={{ color: '#9699a6', fontSize: 13 }}>Loading…</p>
      ) : (
        <table className="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              {isAdmin && <th style={{ width: 120 }}></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar-sm">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={initials(u.display_name)} />
                        : initials(u.display_name)}
                    </div>
                    <span style={{ fontWeight: u.id === currentUser?.id ? 600 : 400 }}>
                      {u.display_name}
                      {u.id === currentUser?.id && <span style={{ fontSize: 11, color: '#9699a6', marginLeft: 6 }}>You</span>}
                    </span>
                  </div>
                </td>
                <td style={{ color: '#676879', fontSize: 13 }}>{u.email}</td>
                <td>
                  {isAdmin && u.id !== currentUser?.id ? (
                    <select
                      className="role-select"
                      value={u.role}
                      disabled={updatingId === u.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`role-badge role-${u.role}`}>{roleLabel(u.role)}</span>
                  )}
                </td>
                <td>
                  {isPending(u) ? (
                    <span style={{ fontSize: 11, color: '#ff7b00', background: '#fff3e0', padding: '2px 7px', borderRadius: 8, fontWeight: 500 }}>
                      Invite pending
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#00854d', background: '#d4f9e8', padding: '2px 7px', borderRadius: 8, fontWeight: 500 }}>
                      Active
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {u.id !== currentUser?.id && (
                      <>
                        <button
                          onClick={() => handleRegenerateInvite(u)}
                          title="Regenerate invite code"
                          style={{ background: 'none', border: '1px solid #c3c6d4', borderRadius: 6, color: '#676879', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}
                        >
                          Invite
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          style={{ background: 'none', border: 'none', color: '#c3c6d4', cursor: 'pointer', fontSize: 16 }}
                          title="Remove member"
                        >×</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 20, padding: '14px 16px', background: '#f0f2f8', borderRadius: 8, fontSize: 13, color: '#676879', lineHeight: 1.6 }}>
        <strong style={{ color: '#323338' }}>How team members join:</strong><br />
        Add a member here, then share their invite code with them. They'll enter their email and invite code on first sign-in to set a password. You can regenerate codes with the Invite button if needed.
      </div>

      {isAdmin && (
        <div style={{ marginTop: 16, padding: '14px 16px', background: '#fff8e1', borderRadius: 8, border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
            <strong style={{ color: '#78350f' }}>Your recovery code</strong><br />
            Generate a new recovery code to save in a secure location. Use it to reset your password if you're ever locked out.
          </div>
          <button
            onClick={handleGenerateRecovery}
            disabled={generatingRecovery}
            style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', cursor: 'pointer', fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {generatingRecovery ? 'Generating…' : 'Generate Code'}
          </button>
        </div>
      )}

      {showAdd && (
        <AddUserModal
          org={org}
          onClose={() => setShowAdd(false)}
          onAdded={(name, email, code) => {
            setShowAdd(false)
            load()
            setInviteModal({ name, email, code })
          }}
        />
      )}

      {inviteModal && (
        <InviteCodeModal
          name={inviteModal.name}
          email={inviteModal.email}
          code={inviteModal.code}
          onClose={() => setInviteModal(null)}
        />
      )}

      {recoveryModal && (
        <RecoveryCodeModal code={recoveryModal} onClose={() => setRecoveryModal(null)} />
      )}
    </div>
  )
}
