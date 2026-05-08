import { useState, useEffect, useRef, useCallback } from 'react'
import type { AppNotification, User } from '../../../shared/types'

interface Props {
  currentUser: User | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr.replace(' ', 'T') + 'Z').getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell({ currentUser }: Props): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    if (!currentUser) return
    const [notes, count] = await Promise.all([
      window.api.notifications.list(currentUser.id, 20) as Promise<AppNotification[]>,
      window.api.notifications.unreadCount(currentUser.id) as Promise<number>
    ])
    setNotifications(notes)
    setUnreadCount(count)
  }, [currentUser])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = async () => {
    setOpen((o) => !o)
    if (!open && currentUser && unreadCount > 0) {
      await window.api.notifications.markAllRead(currentUser.id)
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })))
    }
  }

  if (!currentUser) return null

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300 }}>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={handleOpen}
        style={{
          width: 44, height: 44,
          borderRadius: '50%',
          background: open ? '#0073ea' : '#fff',
          border: '1.5px solid #c3c6d4',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          position: 'relative',
          transition: 'background 0.15s, border-color 0.15s'
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4, right: -4,
            background: '#e2445c',
            color: '#fff',
            borderRadius: '50%',
            width: 18, height: 18,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            bottom: 52, right: 0,
            width: 340,
            background: '#fff',
            border: '1px solid #e6e9f0',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            overflow: 'hidden'
          }}
        >
          <div style={{
            padding: '12px 16px 10px',
            borderBottom: '1px solid #f0f2f8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#323338' }}>Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={async () => {
                  if (!currentUser) return
                  await window.api.notifications.markAllRead(currentUser.id)
                  setUnreadCount(0)
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })))
                }}
                style={{ background: 'none', border: 'none', fontSize: 11, color: '#0073ea', cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9699a6', fontSize: 13 }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '11px 16px',
                    borderBottom: '1px solid #f0f2f8',
                    background: n.read ? '#fff' : '#f0f7ff',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start'
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                    {n.type === 'task_complete' ? '✅' : n.type === 'task_assigned' ? '📌' : '🔄'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#323338', lineHeight: 1.4 }}>{n.message}</div>
                    {n.project_name && (
                      <div style={{ fontSize: 11, color: '#9699a6', marginTop: 2 }}>{n.project_name}</div>
                    )}
                    <div style={{ fontSize: 11, color: '#c3c6d4', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#0073ea', flexShrink: 0, marginTop: 4
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
