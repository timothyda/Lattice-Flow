import { useState, useEffect, useCallback } from 'react'
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
import type { Organization, User, Client, Project, AuthUser, Todo } from '../../shared/types'
import './App.css'

type MainView = 'home' | 'project' | 'client' | 'calendar' | 'users'

function App(): JSX.Element {
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

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
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
  }, [])

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

  const handleSignedIn = useCallback((user: User, auth: AuthUser) => {
    setCurrentUser(user)
    setAuthUser(auth)
    setMainView('home')
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

  if (orgLoading) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center', background: '#f5f6f8' }}>
        <div style={{ color: '#676879', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (!org || showOrgSetup) {
    return (
      <div className="app" style={{ background: '#f5f6f8' }}>
        <OrgSetup onComplete={handleOrgSetupComplete} />
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="app" style={{ background: '#f5f6f8' }}>
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
      {showSettings && (
        <SettingsModal
          org={org}
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onOrgRenamed={(name) => setOrg((prev) => prev ? { ...prev, name } : prev)}
        />
      )}

      <IconRail
        activeView={mainView}
        currentUser={currentUser}
        authUser={authUser}
        showArchive={showArchive}
        onViewChange={setMainView}
        onToggleArchive={() => setShowArchive((v) => !v)}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
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
            defaultTab={focusTodo ? 'time' : undefined}
            focusTodoId={focusTodo?.id ?? null}
            focusTodoTitle={focusTodo?.title ?? null}
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
