import { useState, useRef, useEffect } from 'react'
import type { User, AuthUser } from '../../../../shared/types'
import UserProfileModal from '../UserProfileModal'

type MainView = 'home' | 'project' | 'client' | 'calendar' | 'users'

interface Props {
  activeView: MainView
  currentUser: User | null
  authUser: AuthUser | null
  showArchive: boolean
  onViewChange: (v: MainView) => void
  onToggleArchive: () => void
  onLogin: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onProfileUpdated: (user: User) => void
}

const NAV_ITEMS: { id: MainView; icon: string; label: string }[] = [
  { id: 'home',     icon: '⌂',  label: 'Home' },
  { id: 'calendar', icon: '📅', label: 'Calendar' },
  { id: 'users',    icon: '👥', label: 'Team' },
]

function roleLabel(role: string): string {
  return role === 'admin' ? 'Admin'
    : role === 'project_manager' ? 'Project Manager'
    : role === 'team_member' ? 'Team Member'
    : role === 'client' ? 'Client'
    : role
}

function IconRail({ activeView, currentUser, authUser, showArchive, onViewChange, onToggleArchive, onLogin, onLogout, onOpenSettings, onProfileUpdated }: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  const displayName = currentUser?.display_name ?? authUser?.name ?? ''
  const email = currentUser?.email ?? authUser?.email ?? ''
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        avatarRef.current && !avatarRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleSignOut = () => {
    setMenuOpen(false)
    onLogout()
  }

  const handleOpenProfile = () => {
    setMenuOpen(false)
    setShowProfile(true)
  }

  return (
    <div className="icon-rail">
      <div className="ir-logo">PM</div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`ir-btn${activeView === item.id ? ' active' : ''}`}
          title={item.label}
          onClick={() => onViewChange(item.id)}
        >
          <span className="ir-btn-icon">{item.icon}</span>
          <span className="ir-btn-label">{item.label}</span>
        </button>
      ))}

      <div className="ir-spacer" />

      <button
        className={`ir-btn${showArchive ? ' active' : ''}`}
        title="Archive"
        onClick={onToggleArchive}
      >
        <span className="ir-btn-icon">🗄</span>
        <span className="ir-btn-label">Archive</span>
      </button>

      <button
        className="ir-btn"
        title="Settings"
        onClick={onOpenSettings}
      >
        <span className="ir-btn-icon">⚙</span>
        <span className="ir-btn-label">Settings</span>
      </button>

      {/* User avatar + popup menu */}
      <div style={{ position: 'relative' }}>
        {authUser ? (
          <div
            ref={avatarRef}
            className="ir-avatar"
            title="Account"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {currentUser?.avatar_url
              ? <img src={currentUser.avatar_url} alt={initials} />
              : initials}
          </div>
        ) : (
          <div
            className="ir-avatar"
            style={{ background: '#454f6b', fontSize: 10 }}
            title="Sign in with Microsoft"
            onClick={onLogin}
          >
            Sign in
          </div>
        )}

        {menuOpen && authUser && (
          <div ref={menuRef} className="ir-user-menu">
            <div className="ir-user-menu-header">
              <div className="ir-user-menu-avatar">
                {currentUser?.avatar_url
                  ? <img src={currentUser.avatar_url} alt={initials} />
                  : initials}
              </div>
              <div className="ir-user-menu-info">
                <div className="ir-user-menu-name">{displayName}</div>
                <div className="ir-user-menu-email">{email}</div>
                {currentUser?.role && (
                  <div className="ir-user-menu-role">{roleLabel(currentUser.role)}</div>
                )}
              </div>
            </div>
            <div className="ir-user-menu-divider" />
            <button className="ir-user-menu-item" onClick={handleOpenProfile}>
              My Profile
            </button>
            <button className="ir-user-menu-item ir-user-menu-signout" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {showProfile && currentUser && (
        <UserProfileModal
          user={currentUser}
          onClose={() => setShowProfile(false)}
          onUpdated={(u) => { onProfileUpdated(u); setShowProfile(false) }}
        />
      )}
    </div>
  )
}

export default IconRail
