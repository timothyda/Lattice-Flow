import { useState } from 'react'
import type { Organization, User, AuthUser } from '../../../../shared/types'

interface Props {
  onComplete: (org: Organization, user: User, authUser: AuthUser) => void
}

type Step = 'name' | 'admin' | 'recovery'

function OrgSetup({ onComplete }: Props): JSX.Element {
  const [step, setStep] = useState<Step>('name')
  const [orgName, setOrgName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Stored after org creation so we can show the recovery code
  const [pending, setPending] = useState<{ org: Organization; user: User; authUser: AuthUser; recoveryCode: string } | null>(null)

  const handleNameNext = () => {
    if (!orgName.trim()) return
    setError(null)
    setStep('admin')
  }

  const handleCreate = async () => {
    if (!adminName.trim()) { setError('Name is required.'); return }
    if (!email.trim() || !email.includes('@')) { setError('Valid email is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    setError(null)
    try {
      const result = await window.api.auth.setupOrg(orgName.trim(), adminName.trim(), email.trim(), password)
      if (!result.ok) { setError(result.error); return }
      setPending(result)
      setStep('recovery')
    } catch (err) {
      setError('Something went wrong. Please try again.')
      console.error('[OrgSetup]', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!pending) return
    navigator.clipboard.writeText(pending.recoveryCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDone = () => {
    if (!pending) return
    onComplete(pending.org, pending.user, pending.authUser)
  }

  const stepIndex = step === 'name' ? 0 : step === 'admin' ? 1 : 2

  return (
    <div className="org-setup-screen">
      <div className="org-setup-card">
        <div className="org-setup-logo">PM</div>

        <h1 className="org-setup-title">Welcome to PM App</h1>
        <p className="org-setup-subtitle">
          {step === 'name' && "Let's get you set up. Start by naming your organization."}
          {step === 'admin' && `Setting up "${orgName}". Create your admin account.`}
          {step === 'recovery' && 'Save your recovery code before continuing.'}
        </p>

        <div className="org-setup-step-indicator">
          <div className={`org-setup-dot ${stepIndex === 0 ? 'active' : 'done'}`} />
          <div className={`org-setup-dot ${stepIndex === 1 ? 'active' : stepIndex > 1 ? 'done' : ''}`} />
          <div className={`org-setup-dot ${stepIndex === 2 ? 'active' : ''}`} />
        </div>

        {/* ── Step 1: Org name ── */}
        {step === 'name' && (
          <div className="org-setup-step">
            <input
              className="org-setup-input"
              type="text"
              placeholder="e.g. Acme Studio"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameNext()}
              autoFocus
            />
            {error && <div className="org-setup-error">{error}</div>}
            <button className="org-setup-btn" onClick={handleNameNext} disabled={!orgName.trim()}>
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Admin credentials ── */}
        {step === 'admin' && (
          <div className="org-setup-step">
            {error && <div className="org-setup-error">{error}</div>}
            <input className="org-setup-input" type="text" placeholder="Your full name"
              value={adminName} onChange={(e) => setAdminName(e.target.value)} autoFocus />
            <input className="org-setup-input" type="email" placeholder="Email address"
              value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 8 }} />
            <input className="org-setup-input" type="password" placeholder="Password (min 8 characters)"
              value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 8 }} />
            <input className="org-setup-input" type="password" placeholder="Confirm password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()} style={{ marginTop: 8 }} />
            <button className="org-setup-btn" onClick={handleCreate} style={{ marginTop: 16 }}
              disabled={loading || !adminName.trim() || !email.trim() || !password || !confirmPassword}>
              {loading ? 'Creating…' : 'Create Organization'}
            </button>
            <button className="org-setup-back" onClick={() => { setStep('name'); setError(null) }}>← Back</button>
          </div>
        )}

        {/* ── Step 3: Recovery code ── */}
        {step === 'recovery' && pending && (
          <div className="org-setup-step">
            <div style={{ fontSize: 13, color: '#676879', marginBottom: 12, lineHeight: 1.6 }}>
              Store this code in a secure place (password manager, printed paper, etc).
              If you ever forget your password, this is the only way to recover your account.
              <strong style={{ color: '#d83a52' }}> This code will not be shown again.</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0f2f8', borderRadius: 8, padding: '12px 16px' }}>
              <code style={{ flex: 1, fontSize: 15, letterSpacing: 2, color: '#323338', fontFamily: 'monospace' }}>
                {pending.recoveryCode}
              </code>
              <button onClick={handleCopy}
                style={{ background: '#0073ea', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button className="org-setup-btn" onClick={handleDone} style={{ marginTop: 20 }}>
              I've saved it — Enter the app
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrgSetup
