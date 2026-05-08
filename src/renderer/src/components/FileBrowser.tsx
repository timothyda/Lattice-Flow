import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import type { FileEntry, CopyProgress } from '../../../shared/types'
import FilePreview from './FilePreview'

interface CopyJob {
  id: string
  name: string
  srcPath: string
  loaded: number
  total: number
  done: boolean
  error?: string
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'])
const PREVIEW_EXTS = new Set([...IMAGE_EXTS, '.pdf'])

function entryIcon(entry: FileEntry): string {
  if (entry.type === 'directory') return '📁'
  switch (entry.ext) {
    case '.jpg': case '.jpeg': case '.png': case '.gif':
    case '.webp': case '.svg': case '.bmp': case '.tiff': return '🖼'
    case '.pdf': return '📕'
    case '.mp4': case '.mov': case '.avi': case '.mkv': return '🎬'
    case '.mp3': case '.wav': case '.aac': case '.flac': return '🎵'
    case '.zip': case '.rar': case '.7z': case '.tar': case '.gz': return '📦'
    default: return '📄'
  }
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`
}

interface Props {
  nasPath: string
}

const FB_WIDTH_KEY = 'pm-filebrowser-width'
const FB_COLLAPSED_KEY = 'pm-filebrowser-collapsed'
const FB_MIN = 180
const FB_MAX = 600
const FB_COLLAPSED_W = 28

export default function FileBrowser({ nasPath }: Props): JSX.Element {
  const [currentPath, setCurrentPath] = useState(nasPath)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<FileEntry | null>(null)
  const [copyJobs, setCopyJobs] = useState<CopyJob[]>([])
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [cutEntry, setCutEntry] = useState<{ name: string; fullPath: string } | null>(null)
  const newFolderRef = useRef<HTMLInputElement>(null)

  // ── Resize & collapse ───────────────────────────────────────────────────────
  const [width, setWidth] = useState<number>(() => {
    const s = localStorage.getItem(FB_WIDTH_KEY)
    return s ? Math.min(FB_MAX, Math.max(FB_MIN, Number(s))) : 280
  })
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    localStorage.getItem(FB_COLLAPSED_KEY) === 'true'
  )
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onResizeStart = useCallback((e: React.MouseEvent) => {
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
      // Panel is on the right, so dragging left (negative delta) = wider
      const delta = startX.current - e.clientX
      const next = Math.min(FB_MAX, Math.max(FB_MIN, startW.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(FB_WIDTH_KEY, String(width))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [width])

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(FB_COLLAPSED_KEY, String(!c))
      return !c
    })
  }, [])

  useEffect(() => {
    setCurrentPath(nasPath)
    setPreview(null)
    setCutEntry(null)
  }, [nasPath])

  const loadDir = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await window.api.fs.listDir(path))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read folder')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDir(currentPath) }, [currentPath, loadDir])

  useEffect(() => {
    if (creatingFolder) newFolderRef.current?.focus()
  }, [creatingFolder])

  // global IPC progress listener
  useEffect(() => {
    return window.api.fs.onCopyProgress((p: CopyProgress) => {
      setCopyJobs((prev) =>
        prev.map((j) => j.id === p.id ? { ...j, loaded: p.loaded, total: p.total } : j)
      )
    })
  }, [])

  const navigate = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      setPreview(null)
      setCurrentPath(window.api.path.join(currentPath, entry.name))
    } else {
      setPreview((prev) => (prev?.name === entry.name ? null : entry))
    }
  }

  const goUp = () => {
    if (currentPath === nasPath) return
    setPreview(null)
    setCurrentPath(window.api.path.dirname(currentPath))
  }

  const handleUpload = async () => {
    const srcPaths = await window.api.dialog.pickFiles()
    if (!srcPaths.length) return

    const capturedPath = currentPath
    const jobs: CopyJob[] = srcPaths.map((src) => ({
      id: crypto.randomUUID(),
      name: window.api.path.basename(src),
      srcPath: src,
      loaded: 0,
      total: 0,
      done: false
    }))
    setCopyJobs((prev) => [...prev, ...jobs])

    await Promise.all(
      jobs.map(async (job) => {
        const dest = window.api.path.join(capturedPath, job.name)
        try {
          await window.api.fs.copyFile(job.srcPath, dest, job.id)
          setCopyJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, done: true } : j))
        } catch {
          setCopyJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, done: true, error: 'Copy failed' } : j))
        }
      })
    )

    await loadDir(currentPath)
    setTimeout(() => setCopyJobs((prev) => prev.filter((j) => !j.done)), 2500)
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) { setCreatingFolder(false); return }
    setCreatingFolder(false)
    setNewFolderName('')
    await window.api.fs.mkdir(window.api.path.join(currentPath, name))
    loadDir(currentPath)
  }

  const handleCut = (entry: FileEntry) => {
    setCutEntry({ name: entry.name, fullPath: window.api.path.join(currentPath, entry.name) })
    setPreview(null)
  }

  const handlePaste = async () => {
    if (!cutEntry) return
    try {
      await window.api.fs.moveFile(cutEntry.fullPath, currentPath)
      setCutEntry(null)
      loadDir(currentPath)
    } catch {
      alert(`Could not move "${cutEntry.name}" — it may be open or on a different drive.`)
    }
  }

  // breadcrumb
  const relPath = currentPath.startsWith(nasPath) ? currentPath.slice(nasPath.length) : ''
  const segments = relPath.split(/[/\\]/).filter(Boolean)
  const rootLabel = window.api.path.basename(nasPath)

  const navigateToCrumb = (idx: number) => {
    setPreview(null)
    setCurrentPath(window.api.path.join(nasPath, ...segments.slice(0, idx + 1)))
  }

  const activeJobs = copyJobs.filter((j) => !j.done)

  // Collapsed state: show a thin vertical strip
  if (collapsed) {
    return (
      <div style={{
        width: FB_COLLAPSED_W, minWidth: FB_COLLAPSED_W,
        background: '#fafafa', borderLeft: '1px solid #e6e9f0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 8, cursor: 'default'
      }}>
        <button
          onClick={toggleCollapse}
          title="Expand files panel"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 2px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6, color: '#9699a6',
            width: '100%'
          }}
        >
          <span style={{ fontSize: 14 }}>📁</span>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: '#9699a6',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)'
          }}>Files</span>
        </button>
      </div>
    )
  }

  return (
    <div className="fb-panel" style={{ width, minWidth: width, maxWidth: width, position: 'relative' }}>
      {/* Left drag handle */}
      <div
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute', top: 0, left: 0, width: 5, height: '100%',
          cursor: 'col-resize', zIndex: 10, background: 'transparent',
          transition: 'background 0.15s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,115,234,0.15)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Drag to resize"
      />

      {/* Toolbar */}
      <div className="fb-toolbar">
        <div className="fb-breadcrumb">
          <button className="fb-crumb" onClick={() => { setPreview(null); setCurrentPath(nasPath) }}>
            {rootLabel}
          </button>
          {segments.map((seg, i) => (
            <span key={i} className="fb-crumb-group">
              <span className="fb-sep">/</span>
              <button className="fb-crumb" onClick={() => navigateToCrumb(i)}>{seg}</button>
            </span>
          ))}
        </div>
        <div className="fb-toolbar-right">
          <button className="fb-btn-icon" onClick={goUp} disabled={currentPath === nasPath} title="Go up">↑</button>
          {cutEntry && (
            <button className="fb-btn-paste" onClick={handlePaste} title={`Paste "${cutEntry.name}" here`}>
              📋 Paste here
            </button>
          )}
          <button className="fb-btn-icon" onClick={() => setCreatingFolder(true)} title="New folder">📁+</button>
          <button className="fb-btn-upload" onClick={handleUpload}>⬆ Upload</button>
          <button
            className="fb-btn-icon"
            onClick={toggleCollapse}
            title="Collapse files panel"
            style={{ marginLeft: 2 }}
          >‹</button>
        </div>
      </div>

      {/* New folder input */}
      {creatingFolder && (
        <div className="fb-new-folder-row">
          <span className="fb-icon">📁</span>
          <input
            ref={newFolderRef}
            className="fb-new-folder-input"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') }
            }}
            onBlur={handleCreateFolder}
          />
        </div>
      )}

      {/* Cut notice */}
      {cutEntry && (
        <div className="fb-cut-notice">
          ✂ Moving <strong>{cutEntry.name}</strong> — navigate to the destination folder and click "Paste here"
          <button className="fb-cut-cancel" onClick={() => setCutEntry(null)}>Cancel</button>
        </div>
      )}

      {/* Active copy jobs */}
      {activeJobs.length > 0 && (
        <div className="fb-copy-jobs">
          {activeJobs.map((job) => {
            const pct = job.done ? 100 : (job.total > 0 ? Math.min(100, Math.round((job.loaded / job.total) * 100)) : 0)
            return (
              <div key={job.id} className={`fb-copy-job${job.error ? ' fb-copy-error' : ''}`}>
                <span className="fb-copy-name" title={job.name}>{job.name}</span>
                <div className="fb-progress-bar">
                  <div className="fb-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="fb-copy-pct">{job.error ?? `${pct}%`}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* File list */}
      <div className="fb-list-wrap">
        {loading && (
          <ul className="fb-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="fb-skeleton-row">
                <span className="fb-skel fb-skel-icon" />
                <span className="fb-skel fb-skel-name" style={{ width: `${55 + (i * 17) % 30}%` }} />
                <span className="fb-skel fb-skel-meta" />
              </li>
            ))}
          </ul>
        )}
        {error && <div className="fb-error" title={error}>⚠ {error}</div>}
        {!loading && !error && (
          <ul className="fb-list">
            {entries.length === 0 && <li className="fb-empty">Empty folder</li>}
            {entries.map((entry) => (
              <li
                key={entry.name}
                className={`fb-entry${preview?.name === entry.name ? ' fb-entry-selected' : ''}${cutEntry?.name === entry.name && currentPath === window.api.path.dirname(cutEntry.fullPath) ? ' fb-entry-cut' : ''}`}
                title={entry.name}
              >
                <span className="fb-icon" onClick={() => navigate(entry)}>{entryIcon(entry)}</span>
                <span className="fb-name" onClick={() => navigate(entry)}>{entry.name}</span>
                <span className="fb-meta">
                  {entry.type === 'file' ? fmtSize(entry.size) : ''}
                </span>
                {entry.type === 'file' && (
                  <button
                    className="fb-move-btn"
                    onClick={() => handleCut(entry)}
                    title="Move to another folder"
                  >
                    Move
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Preview pane */}
      {preview && PREVIEW_EXTS.has(preview.ext) && (
        <FilePreview entry={preview} currentPath={currentPath} />
      )}
    </div>
  )
}
