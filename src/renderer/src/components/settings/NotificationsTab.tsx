import { useState, useEffect } from 'react'
import type { User, UserEmailPrefs } from '../../../../shared/types'

interface Props {
  currentUser: User | null
}

interface PrefRow {
  key: keyof Omit<UserEmailPrefs, 'user_id'>
  label: string
  desc: string
}

const PREF_ROWS: PrefRow[] = [
  { key: 'task_assigned',     label: 'Task assigned to me',      desc: 'Receive an email when a task is assigned to you.' },
  { key: 'task_complete',     label: 'Task marked complete',     desc: 'Receive an email when any task in your projects is completed.' },
  { key: 'status_change',     label: 'Task status changes',      desc: 'Receive an email when a task\'s status is updated.' },
  { key: 'meeting_scheduled', label: 'Meeting scheduled',        desc: 'Receive an email when a new meeting is added to a project.' },
]

const DEFAULTS: Omit<UserEmailPrefs, 'user_id'> = {
  task_assigned: true,
  task_complete: true,
  status_change: false,
  meeting_scheduled: true,
}

export default function NotificationsTab({ currentUser }: Props): JSX.Element {
  const [prefs, setPrefs] = useState<Omit<UserEmailPrefs, 'user_id'>>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) return
    window.api.emailPrefs.get(currentUser.id).then((p) => {
      setPrefs({
        task_assigned:     p.task_assigned,
        task_complete:     p.task_complete,
        status_change:     p.status_change,
        meeting_scheduled: p.meeting_scheduled,
      })
      setLoading(false)
    })
  }, [currentUser])

  const handleToggle = async (key: keyof Omit<UserEmailPrefs, 'user_id'>) => {
    if (!currentUser) return
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    setSaving(key)
    await window.api.emailPrefs.set(currentUser.id, updated)
    setSaving(null)
  }

  if (!currentUser) {
    return <p style={{ fontSize: 13, color: '#9699a6' }}>Not logged in.</p>
  }

  if (loading) {
    return <p style={{ fontSize: 13, color: '#9699a6' }}>Loading…</p>
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#676879', marginBottom: 16, lineHeight: 1.6 }}>
        Choose which events send you an email notification. Requires SMTP to be configured in the Email tab.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PREF_ROWS.map(({ key, label, desc }) => {
          const enabled = prefs[key]
          const isSaving = saving === key
          return (
            <div
              key={key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 8,
                background: enabled ? '#f0f8f0' : '#fafbfc',
                border: `1px solid ${enabled ? '#b3e0c0' : '#e6e9f0'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={() => handleToggle(key)}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#323338' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#676879', marginTop: 1 }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                {isSaving && <span style={{ fontSize: 10, color: '#9699a6' }}>saving…</span>}
                <div style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: enabled ? '#00c875' : '#c3c6d4',
                  position: 'relative', transition: 'background 0.15s',
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: enabled ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
