import { useState, useRef, useCallback } from 'react'
import type { Organization, ProjectType } from '../../../shared/types'

interface ImportProject {
  name: string
  description?: string
  status?: 'active' | 'on_hold' | 'complete'
  project_type?: ProjectType
  due_date?: string
}

interface ImportClient {
  name: string
  contact_name?: string
  contact_email?: string
  contact_role?: string
  notes?: string
  description?: string
  projects?: ImportProject[]
}

interface ImportData {
  clients: ImportClient[]
}

interface Props {
  org: Organization
  onClose: () => void
  onImported: () => void
}

type Stage = 'upload' | 'preview' | 'importing' | 'done'

interface ImportResult {
  clientName: string
  clientOk: boolean
  projects: { name: string; ok: boolean }[]
}

const VALID_PROJECT_TYPES = ['website', 'branding_guidelines', 'logo', 'email_marketing', 'saas', 'other']
const VALID_STATUSES = ['active', 'on_hold', 'complete']

function validateImportData(raw: unknown): { data: ImportData; errors: string[] } {
  const errors: string[] = []

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push('File must contain a JSON object at the top level.')
    return { data: { clients: [] }, errors }
  }

  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.clients)) {
    errors.push('Missing "clients" array at the top level.')
    return { data: { clients: [] }, errors }
  }

  const clients: ImportClient[] = []

  ;(obj.clients as unknown[]).forEach((c, i) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      errors.push(`clients[${i}]: must be an object`)
      return
    }
    const client = c as Record<string, unknown>
    if (!client.name || typeof client.name !== 'string' || !client.name.trim()) {
      errors.push(`clients[${i}]: "name" is required`)
      return
    }

    const projects: ImportProject[] = []
    if (client.projects !== undefined) {
      if (!Array.isArray(client.projects)) {
        errors.push(`clients[${i}] ("${client.name}"): "projects" must be an array`)
      } else {
        ;(client.projects as unknown[]).forEach((p, j) => {
          if (!p || typeof p !== 'object' || Array.isArray(p)) {
            errors.push(`clients[${i}].projects[${j}]: must be an object`)
            return
          }
          const proj = p as Record<string, unknown>
          if (!proj.name || typeof proj.name !== 'string' || !proj.name.trim()) {
            errors.push(`clients[${i}].projects[${j}]: "name" is required`)
            return
          }
          if (proj.project_type && !VALID_PROJECT_TYPES.includes(proj.project_type as string)) {
            errors.push(`clients[${i}].projects[${j}] ("${proj.name}"): invalid project_type "${proj.project_type}" — use one of: ${VALID_PROJECT_TYPES.join(', ')}`)
          }
          if (proj.status && !VALID_STATUSES.includes(proj.status as string)) {
            errors.push(`clients[${i}].projects[${j}] ("${proj.name}"): invalid status "${proj.status}" — use one of: active, on_hold, complete`)
          }
          projects.push({
            name: (proj.name as string).trim(),
            description: typeof proj.description === 'string' ? proj.description : undefined,
            status: VALID_STATUSES.includes(proj.status as string) ? (proj.status as 'active' | 'on_hold' | 'complete') : undefined,
            project_type: VALID_PROJECT_TYPES.includes(proj.project_type as string) ? (proj.project_type as ProjectType) : undefined,
            due_date: typeof proj.due_date === 'string' ? proj.due_date : undefined,
          })
        })
      }
    }

    clients.push({
      name: (client.name as string).trim(),
      contact_name:  typeof client.contact_name  === 'string' ? client.contact_name  : undefined,
      contact_email: typeof client.contact_email === 'string' ? client.contact_email : undefined,
      contact_role:  typeof client.contact_role  === 'string' ? client.contact_role  : undefined,
      notes:         typeof client.notes         === 'string' ? client.notes         : undefined,
      description:   typeof client.description   === 'string' ? client.description   : undefined,
      projects,
    })
  })

  return { data: { clients }, errors }
}

const TEMPLATE: ImportData = {
  clients: [
    {
      name: 'Example Client',
      contact_name: 'Jane Smith',
      contact_email: 'jane@example.com',
      contact_role: 'Marketing Director',
      notes: 'Optional notes about this client',
      projects: [
        {
          name: 'Website Redesign',
          description: 'Full site overhaul',
          status: 'active',
          project_type: 'website',
          due_date: '2024-12-31',
        },
        {
          name: 'Logo Refresh',
          project_type: 'logo',
        },
      ],
    },
  ],
}

const FORMAT_HINT = `{
  "clients": [
    {
      "name": "Client Name",          ← required
      "contact_name": "Jane Smith",   ← optional
      "contact_email": "...",         ← optional
      "contact_role": "...",          ← optional
      "notes": "...",                 ← optional
      "description": "...",           ← optional
      "projects": [
        {
          "name": "Project Name",     ← required
          "description": "...",       ← optional
          "status": "active",         ← optional (active | on_hold | complete)
          "project_type": "website",  ← optional (website | logo | branding_guidelines
                                                   | email_marketing | saas | other)
          "due_date": "2024-12-31"    ← optional (YYYY-MM-DD)
        }
      ]
    }
  ]
}`

function ImportModal({ org, onClose, onImported }: Props): JSX.Element {
  const [stage, setStage] = useState<Stage>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importData, setImportData] = useState<ImportData | null>(null)
  const [results, setResults] = useState<ImportResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      setParseErrors(['Only .json files are supported.'])
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string)
        const { data, errors } = validateImportData(raw)
        if (errors.length > 0) { setParseErrors(errors); return }
        if (data.clients.length === 0) { setParseErrors(['No clients found in the file.']); return }
        setParseErrors([])
        setImportData(data)
        setStage('preview')
      } catch {
        setParseErrors(['Invalid JSON — the file could not be parsed.'])
      }
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const downloadTemplate = () => {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'opus-flo-import-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = async () => {
    if (!importData) return
    setStage('importing')
    const total = importData.clients.length
    setProgress({ current: 0, total })
    const allResults: ImportResult[] = []

    for (let i = 0; i < importData.clients.length; i++) {
      const c = importData.clients[i]
      const result: ImportResult = { clientName: c.name, clientOk: false, projects: [] }
      let clientId: number | null = null

      try {
        const created = await window.api.clients.create({
          organization_id: org.id,
          name: c.name,
          contact_name:  c.contact_name  ?? null,
          contact_email: c.contact_email ?? null,
          contact_role:  c.contact_role  ?? null,
          notes:         c.notes         ?? null,
          description:   c.description   ?? null,
          logo_url: null,
        }) as { id: number }
        clientId = created.id
        result.clientOk = true
      } catch {
        result.clientOk = false
      }

      if (clientId !== null && c.projects) {
        for (const p of c.projects) {
          try {
            await window.api.projects.create({
              organization_id: org.id,
              client_id: clientId,
              name: p.name,
              description: p.description ?? '',
              nas_path: '',
              due_date: p.due_date ?? null,
              project_type: p.project_type ?? 'other',
            })
            result.projects.push({ name: p.name, ok: true })
          } catch {
            result.projects.push({ name: p.name, ok: false })
          }
        }
      }

      allResults.push(result)
      setProgress({ current: i + 1, total })
    }

    setResults(allResults)
    setStage('done')
    onImported()
  }

  const totalProjects = importData?.clients.reduce((s, c) => s + (c.projects?.length ?? 0), 0) ?? 0
  const successClients = results.filter((r) => r.clientOk).length
  const successProjects = results.flatMap((r) => r.projects).filter((p) => p.ok).length
  const hasErrors = results.some((r) => !r.clientOk || r.projects.some((p) => !p.ok))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, width: '90vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>

        {/* ── UPLOAD ── */}
        {stage === 'upload' && (
          <>
            <div className="modal-title">Import Clients &amp; Projects</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' }}>
              Upload a JSON file with your clients and projects. Only <strong>name</strong> is required — all other fields are optional.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#0073ea' : 'var(--border)'}`,
                borderRadius: 10,
                padding: 'clamp(14px, 3vh, 32px) 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(0,115,234,0.06)' : 'var(--accent-bg)',
                transition: 'border-color 0.15s, background 0.15s',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Drop your JSON file here</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>or click to browse</div>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>

            {parseErrors.length > 0 && (
              <div style={{ background: 'rgba(226,68,92,0.08)', border: '1px solid rgba(226,68,92,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                {parseErrors.map((err, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#e2445c', marginBottom: i < parseErrors.length - 1 ? 4 : 0 }}>• {err}</div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Expected JSON format</div>
              <pre style={{ fontSize: 11, background: 'var(--accent-bg)', borderRadius: 6, padding: '10px 12px', overflow: 'auto', color: 'var(--text-2)', margin: 0, lineHeight: 1.6, maxHeight: 'clamp(120px, 25vh, 240px)' }}>
                {FORMAT_HINT}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                style={{ fontSize: 12, color: '#0073ea', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={downloadTemplate}
              >
                Download template.json
              </button>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {/* ── PREVIEW ── */}
        {stage === 'preview' && importData && (
          <>
            <div className="modal-title">Preview Import</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>
              <strong>{importData.clients.length}</strong> client{importData.clients.length !== 1 ? 's' : ''} and{' '}
              <strong>{totalProjects}</strong> project{totalProjects !== 1 ? 's' : ''} will be created.
            </p>

            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
              {importData.clients.map((client, i) => (
                <div key={i} style={{ borderBottom: i < importData.clients.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--accent-bg)' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>🏢</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.name}
                    </span>
                    {client.contact_email && (
                      <span style={{ fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>{client.contact_email}</span>
                    )}
                  </div>
                  {client.projects && client.projects.length > 0 ? (
                    client.projects.map((p, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 7px 36px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0073ea', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        {p.project_type && p.project_type !== 'other' && (
                          <span style={{ fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>{p.project_type}</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '7px 14px 7px 36px', fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic' }}>No projects</div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setImportData(null); setStage('upload') }}>Back</button>
              <button className="btn-primary" onClick={doImport}>Import All</button>
            </div>
          </>
        )}

        {/* ── IMPORTING ── */}
        {stage === 'importing' && (
          <>
            <div className="modal-title">Importing…</div>
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                Creating {progress.current} of {progress.total} clients…
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: '#0073ea', borderRadius: 3, transition: 'width 0.3s',
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                }} />
              </div>
            </div>
          </>
        )}

        {/* ── DONE ── */}
        {stage === 'done' && (
          <>
            <div className="modal-title">Import Complete</div>

            <div style={{ display: 'flex', gap: 12, marginBottom: hasErrors ? 16 : 24 }}>
              <div style={{ flex: 1, background: 'rgba(0,200,117,0.1)', border: '1px solid rgba(0,200,117,0.3)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#00c875', lineHeight: 1 }}>{successClients}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>Clients created</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(0,200,117,0.1)', border: '1px solid rgba(0,200,117,0.3)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#00c875', lineHeight: 1 }}>{successProjects}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>Projects created</div>
              </div>
            </div>

            {hasErrors && (
              <div style={{ background: 'rgba(226,68,92,0.08)', border: '1px solid rgba(226,68,92,0.2)', borderRadius: 8, padding: '10px 14px', maxHeight: 160, overflowY: 'auto', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2445c', marginBottom: 6 }}>Errors</div>
                {results.filter((r) => !r.clientOk).map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#e2445c' }}>• Client "{r.clientName}" failed to create</div>
                ))}
                {results.flatMap((r) =>
                  r.projects.filter((p) => !p.ok).map((p) => ({ cn: r.clientName, pn: p.name }))
                ).map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#e2445c' }}>• Project "{e.pn}" under "{e.cn}" failed</div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default ImportModal
