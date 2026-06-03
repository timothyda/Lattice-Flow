import { useState } from 'react'

interface Props {
  onConnected: () => void
}

export default function ServerConnect({ onConnected }: Props): JSX.Element {
  const [step, setStep] = useState<'guide' | 'connect'>('guide')
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

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
  }

  const numStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: '50%',
    background: 'var(--accent)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1,
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '40px 24px', background: 'var(--bg-page)',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#fff',
            margin: '0 auto 14px', letterSpacing: -1,
          }}>LF</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>Opus Flo</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>
            {step === 'guide' ? 'Let\'s get your server set up first.' : 'Connect to your server'}
          </div>
        </div>

        {step === 'guide' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>

              <div style={cardStyle}>
                <div style={numStyle}>1</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
                    Download the server
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    Download <strong style={{ color: 'var(--text-1)' }}>opus-flo-server.zip</strong> from
                    the GitHub releases page and extract it to a permanent folder on
                    your office PC or NAS.
                  </div>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={numStyle}>2</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
                    Configure and start it
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    Copy <code style={{ background: 'var(--surface-rsd)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>.env.example</code> to{' '}
                    <code style={{ background: 'var(--surface-rsd)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>.env</code>,
                    set a <strong style={{ color: 'var(--text-1)' }}>JWT_SECRET</strong>, then run{' '}
                    <code style={{ background: 'var(--surface-rsd)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>start.bat</code>.
                    Requires <strong style={{ color: 'var(--text-1)' }}>Node.js 20</strong> installed on that machine.
                  </div>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={numStyle}>3</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
                    Note the server's IP address
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    On that machine, run <code style={{ background: 'var(--surface-rsd)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>ipconfig</code> (Windows)
                    or <code style={{ background: 'var(--surface-rsd)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>ifconfig</code> (Mac/Linux)
                    and note the local IP address — you'll need it in the next step.
                  </div>
                </div>
              </div>

            </div>

            <button
              onClick={() => setStep('connect')}
              style={{
                width: '100%', padding: 12, borderRadius: 8,
                background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
              }}
            >
              Server is running — Connect now
            </button>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                onClick={() => setStep('connect')}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Already have a server URL? Skip setup guide
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Server URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setStatus('idle'); setError('') }}
                  placeholder="http://192.168.1.100:3847"
                  required
                  autoFocus
                  style={{
                    padding: '10px 12px', borderRadius: 8, fontSize: 14,
                    border: status === 'error'
                      ? '1.5px solid var(--red)'
                      : '1.5px solid var(--border-str)',
                    outline: 'none',
                    background: 'var(--surface-rsd)',
                    color: 'var(--text-1)',
                  }}
                />
                {error && (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>{error}</div>
                )}
              </div>

              <button
                type="submit"
                disabled={status === 'testing' || !url.trim()}
                style={{
                  padding: 12, borderRadius: 8, fontSize: 14, fontWeight: 600,
                  background: status === 'testing' ? 'var(--border-str)' : 'var(--accent)',
                  color: '#fff', border: 'none',
                  cursor: status === 'testing' ? 'not-allowed' : 'pointer',
                }}
              >
                {status === 'testing' ? 'Connecting…' : 'Connect'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => setStep('guide')}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Back to setup guide
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
              Enter the IP and port of the machine running the Opus Flo server.
              <br />
              Ask your administrator if you're not sure.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
