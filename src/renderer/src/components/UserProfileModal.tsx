import { useState } from 'react'
import type { User } from '../../../shared/types'
import { ROLE_LABELS } from '../../../shared/types'

interface Props {
  user: User
  onClose: () => void
  onUpdated: (updated: User) => void
}

export default function UserProfileModal({ user, onClose, onUpdated }: Props): JSX.Element {
  const [displayName, setDisplayName] = useState(user.display_name)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const initials = user.display_name
    .split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  const currentAvatar = previewUrl ?? user.avatar_url

  const handlePickAvatar = async () => {
    const files = await window.api.dialog.pickFiles()
    if (!files[0]) return
    setAvatarUploading(true)
    try {
      const updated = await window.api.users.updateAvatar(user.id, files[0])
      if (updated) {
        onUpdated(updated as User)
        setPreviewUrl((updated as User).avatar_url)
      }
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveName = async () => {
    const trimmed = displayName.trim()
    if (!trimmed || trimmed === user.display_name) return
    setNameSaving(true)
    const updated = await window.api.users.updateDisplayName(user.id, trimmed)
    if (updated) onUpdated(updated as User)
    setNameSaving(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">My Profile</div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div
            onClick={handlePickAvatar}
            style={{
              width: 96, height: 96, borderRadius: '50%',
              background: '#e6f2ff', border: '3px solid #e6e9f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 700, color: '#0073ea',
              cursor: 'pointer', overflow: 'hidden', position: 'relative',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0073ea')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e6e9f0')}
            title="Click to change photo"
          >
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={initials}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.35)'
                e.currentTarget.querySelector('span')!.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0)'
                e.currentTarget.querySelector('span')!.style.opacity = '0'
              }}
            >
              <span style={{ fontSize: 11, color: '#fff', opacity: 0, transition: 'opacity 0.15s', pointerEvents: 'none' }}>
                {avatarUploading ? 'Uploading…' : 'Change photo'}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#9699a6' }}>Click photo to change</div>
        </div>

        {/* Display name */}
        <div className="field">
          <label>Display name</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setNameSaved(false) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              style={{ flex: 1 }}
            />
            <button
              className="btn-primary"
              onClick={handleSaveName}
              disabled={nameSaving || !displayName.trim() || displayName.trim() === user.display_name}
              style={{ whiteSpace: 'nowrap' }}
            >
              {nameSaving ? 'Saving…' : nameSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Read-only info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={ROLE_LABELS[user.role] ?? user.role} />
        </div>

        <div className="modal-actions" style={{ marginTop: 24 }}>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', background: '#f8f9fb', borderRadius: 8,
      border: '1px solid #f0f2f8',
    }}>
      <span style={{ fontSize: 12, color: '#676879', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#323338' }}>{value}</span>
    </div>
  )
}
