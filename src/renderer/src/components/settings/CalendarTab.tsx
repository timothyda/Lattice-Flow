import { useState, useEffect } from 'react'
import type { User, CalendarAccount, CalendarProvider } from '../../../../shared/types'
import { PROVIDER_COLORS, PROVIDER_LABELS } from '../../../../shared/types'

interface Props {
  currentUser: User | null
}

const OAUTH_PROVIDERS: CalendarProvider[] = ['microsoft', 'google', 'zoom']

const PROVIDER_ICONS: Record<CalendarProvider, string> = {
  microsoft: 'M',
  google:    'G',
  zoom:      'Z',
  caldav:    '☁',
}

export default function CalendarTab({ currentUser }: Props): JSX.Element {
  const [accounts, setAccounts] = useState<CalendarAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingProvider, setConnectingProvider] = useState<CalendarProvider | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  // CalDAV form state
  const [showCalDAV, setShowCalDAV] = useState(false)
  const [caldavUrl, setCaldavUrl] = useState('')
  const [caldavUser, setCaldavUser] = useState('')
  const [caldavPass, setCaldavPass] = useState('')
  const [caldavLabel, setCaldavLabel] = useState('')
  const [caldavLoading, setCaldavLoading] = useState(false)
  const [caldavError, setCaldavError] = useState<string | null>(null)

  const userId = currentUser?.id

  useEffect(() => {
    if (!userId) return
    window.api.calendar.getAccounts(userId).then(setAccounts).finally(() => setLoading(false))
  }, [userId])

  const handleConnectOAuth = async (provider: CalendarProvider) => {
    if (!userId) return
    setConnectingProvider(provider)
    setConnectError(null)
    const result = await window.api.calendar.connect(userId, provider)
    if (result.ok) {
      setAccounts((prev) => [...prev, result.account])
    } else {
      setConnectError(`${PROVIDER_LABELS[provider]}: ${result.error}`)
    }
    setConnectingProvider(null)
  }

  const handleConnectCalDAV = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !caldavUrl.trim() || !caldavUser.trim()) return
    setCaldavLoading(true)
    setCaldavError(null)
    const result = await window.api.calendar.connectCalDAV(
      userId, caldavUrl.trim(), caldavUser.trim(), caldavPass, caldavLabel.trim()
    )
    if (result.ok) {
      setAccounts((prev) => [...prev, result.account])
      setShowCalDAV(false)
      setCaldavUrl(''); setCaldavUser(''); setCaldavPass(''); setCaldavLabel('')
    } else {
      setCaldavError(result.error ?? 'Connection failed')
    }
    setCaldavLoading(false)
  }

  const handleDisconnect = async (accountId: number) => {
    await window.api.calendar.disconnect(accountId)
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }

  const connectedProviders = new Set(accounts.map((a) => a.provider))

  return (
    <div>
      <h4 className="settings-section-title">Calendar Accounts</h4>
      <p className="settings-section-hint">
        Connect your calendar accounts to see events in the Calendar view. Each account syncs independently.
      </p>

      {/* Connected accounts list */}
      {!loading && accounts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {accounts.map((acc) => (
            <div key={acc.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: '#f8f9fb',
              border: '1px solid #e6e9f0', borderRadius: 8, marginBottom: 8,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: acc.color, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {PROVIDER_ICONS[acc.provider]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#323338', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {acc.account_label}
                </div>
                <div style={{ fontSize: 11, color: '#9699a6' }}>
                  {PROVIDER_LABELS[acc.provider]}{acc.account_email ? ` · ${acc.account_email}` : ''}
                </div>
              </div>
              <button
                onClick={() => handleDisconnect(acc.id)}
                style={{
                  background: 'none', border: '1px solid #e2445c', color: '#e2445c',
                  borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Disconnect
              </button>
            </div>
          ))}
        </div>
      )}

      {connectError && (
        <div style={{ background: '#fff5f5', border: '1px solid #e2445c', color: '#e2445c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          {connectError}
        </div>
      )}

      {/* OAuth provider buttons */}
      <h4 className="settings-section-title" style={{ marginTop: 4 }}>Add Account</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {OAUTH_PROVIDERS.map((provider) => (
          <button
            key={provider}
            onClick={() => handleConnectOAuth(provider)}
            disabled={connectingProvider !== null}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${PROVIDER_COLORS[provider]}`,
              background: connectingProvider === provider ? PROVIDER_COLORS[provider] : '#fff',
              color: connectingProvider === provider ? '#fff' : PROVIDER_COLORS[provider],
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            <span style={{ fontWeight: 700 }}>{PROVIDER_ICONS[provider]}</span>
            {connectingProvider === provider
              ? `Opening ${PROVIDER_LABELS[provider]}…`
              : `Add ${PROVIDER_LABELS[provider]}`}
            {connectedProviders.has(provider) && connectingProvider !== provider && (
              <span style={{ fontSize: 11, opacity: 0.7 }}>(+1 more)</span>
            )}
          </button>
        ))}

        <button
          onClick={() => { setShowCalDAV((v) => !v); setCaldavError(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            border: `1.5px solid ${PROVIDER_COLORS.caldav}`,
            background: showCalDAV ? PROVIDER_COLORS.caldav : '#fff',
            color: showCalDAV ? '#fff' : PROVIDER_COLORS.caldav,
            fontSize: 13, fontWeight: 600,
          }}
        >
          <span>☁</span> Add CalDAV Server
        </button>
      </div>

      {/* CalDAV form */}
      {showCalDAV && (
        <form onSubmit={handleConnectCalDAV} style={{
          background: '#f8f9fb', border: '1px solid #e6e9f0',
          borderRadius: 10, padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#323338', marginBottom: 12 }}>
            CalDAV Connection
          </div>
          <p style={{ fontSize: 12, color: '#9699a6', marginBottom: 12, marginTop: 0 }}>
            Compatible with Nextcloud, Baikal, Radicale, Apple Calendar, Fastmail, and any CalDAV server.
          </p>

          {[
            { label: 'Server URL', value: caldavUrl, setter: setCaldavUrl, type: 'url', placeholder: 'https://nextcloud.example.com', required: true },
            { label: 'Username', value: caldavUser, setter: setCaldavUser, type: 'text', placeholder: 'your@email.com or username', required: true },
            { label: 'Password / App password', value: caldavPass, setter: setCaldavPass, type: 'password', placeholder: '••••••••', required: false },
            { label: 'Display label (optional)', value: caldavLabel, setter: setCaldavLabel, type: 'text', placeholder: 'Work Calendar', required: false },
          ].map(({ label, value, setter, type, placeholder, required }) => (
            <div className="field" key={label} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12 }}>{label}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                required={required}
                style={{ fontSize: 13 }}
              />
            </div>
          ))}

          {caldavError && (
            <div style={{ color: '#e2445c', fontSize: 12, marginBottom: 10 }}>{caldavError}</div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-primary" disabled={caldavLoading} style={{ fontSize: 13 }}>
              {caldavLoading ? 'Testing connection…' : 'Connect'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowCalDAV(false)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Setup hints */}
      <div style={{ borderTop: '1px solid #f0f2f8', paddingTop: 16, marginTop: 8 }}>
        <div style={{ fontSize: 12, color: '#9699a6', lineHeight: 1.6 }}>
          <strong style={{ color: '#676879' }}>Setup required in .env:</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 16 }}>
            <li><code>AZURE_CLIENT_ID</code> — from Azure portal (App registrations)</li>
            <li><code>GOOGLE_CLIENT_ID</code> + <code>GOOGLE_CLIENT_SECRET</code> — from Google Cloud Console</li>
            <li><code>ZOOM_CLIENT_ID</code> + <code>ZOOM_CLIENT_SECRET</code> — from Zoom Marketplace</li>
          </ul>
          CalDAV connections use credentials only — no .env needed.
        </div>
      </div>
    </div>
  )
}
