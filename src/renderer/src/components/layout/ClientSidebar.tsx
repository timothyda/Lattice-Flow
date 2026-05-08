import { useState, useRef, useCallback, useEffect } from 'react'
import NewClientModal from '../clients/NewClientModal'
import NewProjectModal from '../projects/NewProjectModal'
import type { Organization, Client, Project, User } from '../../../../shared/types'

interface Props {
  org: Organization
  clients: Client[]
  projectsByClient: Record<number, Project[]>
  expandedClients: Set<number>
  selectedClientId: number | null
  selectedProjectId: number | null
  currentUser: User | null
  onClientToggle: (clientId: number) => void
  onClientOpen: (clientId: number) => void
  onProjectSelect: (projectId: number, clientId: number) => void
  onClientCreated: () => void
  onProjectCreated: (newId: number, clientId: number) => void
  onArchiveClient: (clientId: number) => void
  onArchiveProject: (projectId: number) => void
}

const SIDEBAR_WIDTH_KEY = 'pm-sidebar-width'
const MIN_W = 150
const MAX_W = 480

function ClientSidebar({
  org, clients, projectsByClient, expandedClients,
  selectedClientId, selectedProjectId, currentUser,
  onClientToggle, onClientOpen, onProjectSelect, onClientCreated, onProjectCreated,
  onArchiveClient, onArchiveProject
}: Props): JSX.Element {
  const [showNewClient, setShowNewClient] = useState(false)
  const [newProjectClientId, setNewProjectClientId] = useState<number | null>(null)

  // ── Resizable sidebar ───────────────────────────────────────────────────────
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    return saved ? Math.min(MAX_W, Math.max(MIN_W, Number(saved))) : 220
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [width])

  const handleAddProject = (e: React.MouseEvent, clientId: number) => {
    e.stopPropagation()
    setNewProjectClientId(clientId)
  }

  return (
    <aside className="client-sidebar" style={{ width, minWidth: width, maxWidth: width, position: 'relative' }}>
      <div className="cs-header">
        <span className="cs-org-name">{org.name}</span>
      </div>

      <div className="cs-section-label">
        Clients
        <button className="cs-add-btn" title="Add client" onClick={() => setShowNewClient(true)}>+</button>
      </div>

      <div className="cs-tree">
        {clients.length === 0 && (
          <div className="cs-empty">No clients yet</div>
        )}

        {clients.map((client) => {
          const isExpanded = expandedClients.has(client.id)
          const isSelected = selectedClientId === client.id
          const projects = projectsByClient[client.id] ?? []

          return (
            <div key={client.id} className="cs-client">
              <div
                className={`cs-client-row${isSelected ? ' selected' : ''}`}
                onClick={() => onClientToggle(client.id)}
              >
                <span className={`cs-chevron${isExpanded ? ' open' : ''}`}>›</span>
                <span className="cs-client-icon">🏢</span>
                <span className="cs-client-name" title={client.name}>{client.name}</span>
                <button
                  className="cs-client-add-proj cs-row-action"
                  title="Add project"
                  onClick={(e) => handleAddProject(e, client.id)}
                >+</button>
                <button
                  className="cs-info-btn cs-row-action"
                  title="View client dashboard"
                  onClick={(e) => { e.stopPropagation(); onClientOpen(client.id) }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
                    <line x1="6" y1="5" x2="6" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="6" cy="3.2" r="0.7" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  className="cs-archive-btn cs-row-action"
                  title="Archive client"
                  onClick={(e) => { e.stopPropagation(); onArchiveClient(client.id) }}
                >🗄</button>
              </div>

              {isExpanded && (
                <div className="cs-projects">
                  {projects.length === 0 && (
                    <div className="cs-empty">No projects</div>
                  )}
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className={`cs-project-row${project.id === selectedProjectId ? ' selected' : ''}`}
                      onClick={() => onProjectSelect(project.id, client.id)}
                    >
                      <div className="cs-project-dot" />
                      <span className="cs-project-name" title={project.name}>{project.name}</span>
                      <button
                        className="cs-archive-btn cs-row-action"
                        title="Archive project"
                        onClick={(e) => { e.stopPropagation(); onArchiveProject(project.id) }}
                      >🗄</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showNewClient && (
        <NewClientModal
          org={org}
          onClose={() => setShowNewClient(false)}
          onCreated={() => { setShowNewClient(false); onClientCreated() }}
        />
      )}

      {newProjectClientId !== null && (
        <NewProjectModal
          org={org}
          clientId={newProjectClientId}
          currentUser={currentUser}
          onClose={() => setNewProjectClientId(null)}
          onCreated={(id) => { setNewProjectClientId(null); onProjectCreated(id, newProjectClientId!) }}
        />
      )}

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute', top: 0, right: 0, width: 5, height: '100%',
          cursor: 'col-resize', zIndex: 20,
          background: 'transparent',
          transition: 'background 0.15s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Drag to resize"
      />
    </aside>
  )
}

export default ClientSidebar
