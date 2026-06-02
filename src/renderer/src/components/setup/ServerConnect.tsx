import { useState } from 'react'

interface Props {
  onConnected: () => void
}

export default function ServerConnect({ onConnected }: Props): JSX.Element {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'testing' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleConnect(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = url.trim().replace(/\/+$/, '')
    if (!trimmed) return

    setStatus('testing')
    setError('')

    const result = await window.api.connection.setUrl(trimmed)
    if (result.ok) {
      onConnected()
    } else {
      setStatus('error')
      setError(result.error ?? 'Could not reach the server. Check the URL and try again.')
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '40px 24px', gap: 0
    }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#0073ea', marginBottom: 8 }}>Opus Flo</div>
        <div style={{ fontSize: 15, color: '#676879' }}>Connect to your organization's server</div>
      </div>

      <form onSubmit={handleConnect} style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#323338' }}>Server URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setStatus('idle'); setError('') }}
            placeholder="http://192.168.1.100:3847"
            required
            autoFocus
            style={{
              padding: '10px 12px', borderRadius: 8, fontSize: 14,
              border: status === 'error' ? '1.5px solid #e2445c' : '1.5px solid #dde3eb',
              outline: 'none', background: '#fff', color: '#323338'
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#e2445c', marginTop: 2 }}>{error}</div>
          )}
        </div>

        <button
          type="submit"
          disabled={status === 'testing' || !url.trim()}
          style={{
            padding: '11px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: status === 'testing' ? '#c5d0e0' : '#0073ea',
            color: '#fff', border: 'none', cursor: status === 'testing' ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s'
          }}
        >
          {status === 'testing' ? 'Connecting…' : 'Connect'}
        </button>

        <div style={{ fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 1.5 }}>
          Ask your administrator for the server address.
          <br />
          Typically runs on your office NAS or local network.
        </div>
      </form>
    </div>
  )
}
