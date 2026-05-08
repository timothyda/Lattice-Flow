import { useState, useEffect, useCallback, useRef } from 'react'
import type { ArchivedItem, Organization } from '../../../shared/types'

interface Props {
  org: Organization
  onClose: () => void
  onRestored: () => void
}

function fmtDate(s: string): string {
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-CA')
}

export default function ArchiveOverlay({ org, onClose, onRestored }: Props): JSX.Element {
  const [items, setItems] = useState<ArchivedItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const result = q.trim()
        ? await window.api.archive.search(org.id, q.trim())
        : await window.api.archive.list(org.id)
      setItems(result)
    } finally {
      setLoading(false)
    }
  }, [org.id])

  useEffect(() => {
    load('')
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [load])

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => load(query), 250)
    return () => clearTimeout(t)
  }, [query, load])

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleRestore = async (item: ArchivedItem) => {
    const key = `${item.kind}-${item.id}`
    setRestoringId(key)
    try {
      if (item.kind === 'client') {
        await window.api.clients.restore(item.id)
      } else {
        await window.api.projects.restore(item.id)
      }
      onRestored()
      await load(query)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 12,
        width: 620, maxWidth: '90vw', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #e6e9f0',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontSize: 20 }}>🗄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#323338' }}>Archive</div>
            <div style={{ fontSize: 12, color: '#676879' }}>Archived clients and projects</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: '#676879', lineHeight: 1, padding: 4
            }}
          >×</button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f2f8' }}>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archived items…"
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #c5c7d4', borderRadius: 6,
              padding: '8px 12px', fontSize: 14, outline: 'none',
              color: '#323338'
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#0073ea')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#c5c7d4')}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: '#9699a6', fontSize: 14 }}>
              Loading…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9699a6' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗄</div>
              <div style={{ fontSize: 14 }}>{query ? 'No matches found' : 'Archive is empty'}</div>
            </div>
          )}
          {!loading && items.map((item) => {
            const key = `${item.kind}-${item.id}`
            const restoring = restoringId === key
            return (
              <div
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 24px',
                  borderBottom: '1px solid #f5f6f8',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f6f8')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>
                  {item.kind === 'client' ? '🏢' : '📋'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: '#323338',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#9699a6', marginTop: 2 }}>
                    {item.kind === 'project' && item.parent_name
                      ? `Project · ${item.parent_name}`
                      : 'Client'}
                    {' · '}Archived {fmtDate(item.archived_at)}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(item)}
                  disabled={restoring}
                  style={{
                    background: restoring ? '#e6f2ff' : '#0073ea',
                    color: restoring ? '#0073ea' : '#fff',
                    border: 'none', borderRadius: 6,
                    padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    cursor: restoring ? 'default' : 'pointer',
                    flexShrink: 0, transition: 'background 0.15s'
                  }}
                >
                  {restoring ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
