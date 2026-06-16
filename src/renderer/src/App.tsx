import { useState, useEffect, useCallback } from 'react'
import ServerConnect from './components/setup/ServerConnect'
import OrgSetup from './components/setup/OrgSetup'
import SignInView from './components/setup/SignInView'
import IconRail from './components/layout/IconRail'
import ClientSidebar from './components/layout/ClientSidebar'
import HomeView from './views/HomeView'
import UserManagementView from './views/UserManagementView'
import ProjectView from './components/ProjectView'
import ClientView from './components/ClientView'
import CalendarView from './views/CalendarView'
import SettingsModal from './components/SettingsModal'
import NotificationBell from './components/NotificationBell'
import ArchiveOverlay from './components/ArchiveOverlay'
import type { Organization, User, Client, Project, AuthUser, Todo, OrgFeatures } from '../../shared/types'
import './App.css'

type MainView = 'home' | 'project' | 'client' | 'calendar' | 'users'
type ConnState = 'unknown' | 'no_server' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'auth_expired'

function ConnectionBanner({ state, onRetry, onChangeUrl }: { state: ConnState; onRetry: () => void; onChangeUrl: () => void }): JSX.Element | null {
  if (state === 'reconnecting') return (
    <div style={{ background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', padding: '6px 16px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
      Connection lost — reconnecting…
    </div>
  )
  if (state === 'disconnected') return (
    <div style={{ background: '#e2445c', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', padding: '6px 16px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
      <span>Cannot reach server.</span>
      <button onClick={onRetry} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>
      <button onClick={onChangeUrl} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Change Server URL</button>
    </div>
  )
  return null
}

function App(): JSX.Element {
  const [connState, setConnState] = useState<ConnState>('unknown')
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgLoading, setOrgLoading] = useState(true)
  const [showOrgSetup, setShowOrgSetup] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  const [clients, setClients] = useState<Client[]>([])
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set())
  const [projectsByClient, setProjectsByClient] = useState<Record<number, Project[]>>({})

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [mainView, setMainView] = useState<MainView>('home')
  const [focusTodo, setFocusTodo] = useState<Todo | null>(null)
  const [projectResetKey, setProjectResetKey] = useState(0)

  const [showSettings, setShowSettings] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [orgFeatures, setOrgFeatures] = useState<OrgFeatures | null>(null)

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme') === 'dark'
    document.documentElement.setAttribute('data-theme', saved ? 'dark' : 'light')
    return saved
  })

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  // ── Connection state ───────────────────────────────────────────────────────

  useEffect(() => {
    window.api.connection.getState().then((s) => setConnState(s as ConnState))
    const unsub = window.api.connection.onStateChange((s) => {
      setConnState(s as ConnState)
      // When auth expires, force re-auth
      if (s === 'auth_expired') { setAuthUser(null); setCurrentUser(null) }
    })
    return unsub
  }, [])

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    // Don't attempt to load data until we have a server connection
    if (connState === 'unknown' || connState === 'no_server' || connState === 'connecting') return
    Promise.all([
      window.api.org.get(),
      window.api.auth.status(),
      window.api.auth.getCurrentUser(),
      window.api.prefs.get()
    ]).then(([orgData, auth, user, prefs]) => {
      setOrg(orgData as Organization | null)
      setAuthUser(auth as AuthUser | null)
      setCurrentUser(user as User | null)
      if (prefs.lastClientId) setSelectedClientId(prefs.lastClientId)
      if (prefs.lastProjectId) { setSelectedProjectId(prefs.lastProjectId); setMainView('project') }
    }).finally(() => setOrgLoading(false))
  }, [connState])

  useEffect(() => {
    if (!org) return
    window.api.orgFeatures.get(org.id).then(setOrgFeatures)
  }, [org?.id])

  // Load clients + their projects when org is set
  useEffect(() => {
    if (!org) return
    loadClients()
  }, [org])

  const loadClients = useCallback(async () => {
    if (!org) return
    const data = await window.api.clients.list(org.id) as Client[]
    setClients(data)
    const entries = await Promise.all(
      data.map(async (c) => {
        const projs = await window.api.projects.byClient(c.id) as Project[]
        return [c.id, projs] as [number, Project[]]
      })
    )
    setProjectsByClient(Object.fromEntries(entries))
  }, [org])

  // ── Org setup / sign-in completion ────────────────────────────────────────

  const handleOrgSetupComplete = useCallback((newOrg: Organization, user: User, auth: AuthUser) => {
    setOrg(newOrg)
    setCurrentUser(user)
    setAuthUser(auth)
    setShowOrgSetup(false)
    setMainView('home')
  }, [])

  const handleSignedIn = useCallback(async (user: User, auth: AuthUser) => {
    setCurrentUser(user)
    setAuthUser(auth)
    setMainView('home')
    // Reload org + clients with the authenticated user's context so the sidebar
    // is always populated from a confirmed post-login DB state.
    const freshOrg = await window.api.org.get() as Organization | null
    setOrg(freshOrg)
    setSelectedClientId(null)
    setSelectedProjectId(null)
    // Reconnect the WebSocket with the fresh JWT. This transitions connState
    // away from 'auth_expired' (connecting → connected), which unblocks the
    // render gate that was keeping the app stuck on the sign-in screen.
    window.api.connection.retry()
  }, [])

  // ── Auth ───────────────────────────────────────────────────────────────────

  // Login is now handled exclusively through the SignInView screen.
  // This no-op satisfies props on components that still accept onLogin.
  const handleLogin = useCallback(() => {}, [])

  const handleLogout = useCallback(async () => {
    await window.api.auth.logout()
    setAuthUser(null)
    setCurrentUser(null)
  }, [])

  // ── Client navigation ──────────────────────────────────────────────────────

  const handleClientToggle = useCallback((clientId: number) => {
    setExpandedClients((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
    setSelectedClientId(clientId)
    window.api.prefs.set({ lastClientId: clientId })
  }, [])

  const handleProjectSelect = useCallback((projectId: number, clientId: number) => {
    setSelectedProjectId(projectId)
    setSelectedClientId(clientId)
    setFocusTodo(null)
    setMainView('project')
    // If clicking the already-selected project, reset to overview tab
    setProjectResetKey((k) => k + 1)
    window.api.prefs.set({ lastProjectId: projectId, lastClientId: clientId })
  }, [])

  // Called from HomeView when user clicks a task — navigate to its project's Time tab
  const handleOpenTask = useCallback((todo: Todo) => {
    setSelectedProjectId(todo.project_id)
    setFocusTodo(todo)
    setMainView('project')
    window.api.prefs.set({ lastProjectId: todo.project_id })
  }, [])

  const handleClientOpen = useCallback((clientId: number) => {
    setSelectedClientId(clientId)
    setMainView('client')
  }, [])

  const handleClientCreated = useCallback(async () => {
    await loadClients()
  }, [loadClients])

  const handleProjectCreated = useCallback(async (newId: number, clientId: number) => {
    await loadClients()
    setSelectedProjectId(newId)
    setSelectedClientId(clientId)
    setMainView('project')
    window.api.prefs.set({ lastProjectId: newId, lastClientId: clientId })
  }, [loadClients])

  const handleProjectDeleted = useCallback(async (id: number) => {
    await loadClients()
    if (selectedProjectId === id) {
      setSelectedProjectId(null)
      setMainView('home')
      window.api.prefs.set({ lastProjectId: null })
    }
  }, [loadClients, selectedProjectId])

  const handleArchiveClient = useCallback(async (clientId: number) => {
    await window.api.clients.archive(clientId)
    await loadClients()
    if (selectedClientId === clientId) {
      setSelectedClientId(null)
      setSelectedProjectId(null)
      setMainView('home')
      window.api.prefs.set({ lastClientId: null, lastProjectId: null })
    }
  }, [loadClients, selectedClientId])

  const handleArchiveProject = useCallback(async (projectId: number) => {
    await window.api.projects.archive(projectId)
    await loadClients()
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null)
      setMainView('home')
      window.api.prefs.set({ lastProjectId: null })
    }
  }, [loadClients, selectedProjectId])

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedProject = selectedProjectId
    ? Object.values(projectsByClient).flat().find((p) => p.id === selectedProjectId) ?? null
    : null

  // ── Loading / Setup screens ────────────────────────────────────────────────

  // ── Connection gates ───────────────────────────────────────────────────────

  if (connState === 'unknown') {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
        <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Connecting…</div>
      </div>
    )
  }

  if (connState === 'no_server') {
    return (
      <div className="app" style={{ background: 'var(--bg-page)' }}>
        <ServerConnect onConnected={() => setConnState('connecting')} />
      </div>
    )
  }

  if (connState === 'connecting') {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
        <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Connecting to server…</div>
      </div>
    )
  }

  if (orgLoading) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
        <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (connState === 'auth_expired') {
    return (
      <div className="app" style={{ background: 'var(--bg-page)' }}>
        <SignInView
          org={org}
          onSignedIn={handleSignedIn}
          onCreateNewOrg={() => setShowOrgSetup(true)}
        />
      </div>
    )
  }

  if (!org || showOrgSetup) {
    return (
      <div className="app" style={{ background: 'var(--bg-page)' }}>
        <OrgSetup onComplete={handleOrgSetupComplete} />
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="app" style={{ background: 'var(--bg-page)' }}>
        <SignInView
          org={org}
          onSignedIn={handleSignedIn}
          onCreateNewOrg={() => setShowOrgSetup(true)}
        />
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <ConnectionBanner
        state={connState}
        onRetry={() => window.api.connection.retry()}
        onChangeUrl={() => window.api.connection.clearUrl().then(() => setConnState('no_server'))}
      />
      {showSettings && (
        <SettingsModal
          org={org}
          currentUser={currentUser}
          onClose={() => {
            setShowSettings(false)
            window.api.orgFeatures.get(org.id).then(setOrgFeatures)
          }}
          onOrgRenamed={(name) => setOrg((prev) => prev ? { ...prev, name } : prev)}
        />
      )}

      <IconRail
        activeView={mainView}
        currentUser={currentUser}
        authUser={authUser}
        showArchive={showArchive}
        darkMode={darkMode}
        onViewChange={setMainView}
        onToggleArchive={() => setShowArchive((v) => !v)}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
        onToggleTheme={toggleTheme}
        onProfileUpdated={(u) => setCurrentUser(u)}
      />

      <ClientSidebar
        org={org}
        clients={clients}
        projectsByClient={projectsByClient}
        expandedClients={expandedClients}
        selectedClientId={selectedClientId}
        selectedProjectId={selectedProjectId}
        currentUser={currentUser}
        onClientToggle={handleClientToggle}
        onClientOpen={handleClientOpen}
        onProjectSelect={handleProjectSelect}
        onClientCreated={handleClientCreated}
        onProjectCreated={handleProjectCreated}
        onArchiveClient={handleArchiveClient}
        onArchiveProject={handleArchiveProject}
        onProjectMoved={loadClients}
      />

      {showArchive && (
        <ArchiveOverlay
          org={org}
          onClose={() => setShowArchive(false)}
          onRestored={loadClients}
        />
      )}

      <NotificationBell currentUser={currentUser} />

      <main className="main-content">
        {mainView === 'home' && (
          <HomeView
            currentUser={currentUser}
            authUser={authUser}
            org={org}
            onLogin={handleLogin}
            onOpenTask={handleOpenTask}
          />
        )}

        {mainView === 'calendar' && (
          <CalendarView
            currentUser={currentUser}
            projects={Object.values(projectsByClient).flat()}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}

        {mainView === 'users' && (
          <UserManagementView org={org} currentUser={currentUser} />
        )}

        {mainView === 'client' && (() => {
          const c = clients.find((cl) => cl.id === selectedClientId) ?? null
          return c ? (
            <ClientView
              key={c.id}
              client={c}
              projects={projectsByClient[c.id] ?? []}
              onClientUpdated={(updated) => {
                setClients((prev) => prev.map((cl) => cl.id === updated.id ? updated : cl))
              }}
              onProjectSelect={(projectId) => handleProjectSelect(projectId, c.id)}
            />
          ) : null
        })()}

        {mainView === 'project' && selectedProject ? (
          <ProjectView
            key={`${selectedProject.id}-${focusTodo?.id ?? 'none'}-${projectResetKey}`}
            project={selectedProject}
            orgFeatures={orgFeatures}
            defaultTab={focusTodo ? 'time' : undefined}
            focusTodoId={focusTodo?.id ?? null}
            focusTodoTitle={focusTodo?.title ?? null}
            currentUserId={currentUser?.id}
            onProjectUpdated={loadClients}
            onProjectDeleted={() => handleProjectDeleted(selectedProject.id)}
            onProjectArchived={() => handleArchiveProject(selectedProject.id)}
          />
        ) : mainView === 'project' ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No project selected</div>
            <div className="empty-state-hint">Select a project from the sidebar</div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
