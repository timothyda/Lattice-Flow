import { useState } from 'react'
import type { Organization, User, AuthUser } from '../../../../shared/types'

type Mode = 'login' | 'activate' | 'migrate' | 'forgot'

interface Props {
  org: Organization
  onSignedIn: (user: User, authUser: AuthUser) => void
  onCreateNewOrg: () => void
}

// Shared password + confirm fields used in migrate, forgot, activate modes
function PasswordFields({
  newPassword, confirmPassword,
  onNewPassword, onConfirm,
  onSubmit
}: {
  newPassword: string
  confirmPassword: string
  onNewPassword: (v: string) => void
  onConfirm: (v: string) => void
  onSubmit: () => void
}): JSX.Element {
  return (
    <>
      <input
        className="org-setup-input"
        type="password"
        placeholder="New password (min 8 characters)"
        value={newPassword}
        onChange={(e) => onNewPassword(e.target.value)}
        style={{ marginTop: 8 }}
      />
      <input
        className="org-setup-input"
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => onConfirm(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        style={{ marginTop: 8 }}
      />
    </>
  )
}

// After migration/recovery — show the recovery code before entering the app
function RecoveryCodeStep({ code, onDone }: { code: string; onDone: () => void }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="org-setup-step">
      <div style={{ fontSize: 13, color: '#676879', marginBottom: 12, lineHeight: 1.6 }}>
        Save this recovery code somewhere safe — you'll need it if you ever forget your password.
        <strong style={{ color: '#d83a52' }}> It will not be shown again.</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0f2f8', borderRadius: 8, padding: '12px 16px' }}>
        <code style={{ flex: 1, fontSize: 15, letterSpacing: 2, color: '#323338', fontFamily: 'monospace' }}>
          {code}
        </code>
        <button
          onClick={copy}
          style={{ background: '#0073ea', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <button className="org-setup-btn" onClick={onDone} style={{ marginTop: 20 }}>
        I've saved it — Enter the app
      </button>
    </div>
  )
}

function SignInView({ org, onSignedIn, onCreateNewOrg }: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recovery code display after migrate/forgot
  const [pendingSignIn, setPendingSignIn] = useState<{ user: User; authUser: AuthUser; recoveryCode: string } | null>(null)

  // Login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Shared new-password fields (activate, migrate, forgot)
  const [targetEmail, setTargetEmail] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const switchMode = (m: Mode, prefillEmail = '') => {
    setMode(m)
    setError(null)
    if (prefillEmail) setTargetEmail(prefillEmail)
  }

  const resetFields = () => {
    setNewPassword('')
    setConfirmPassword('')
    setRecoveryCode('')
    setInviteCode('')
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.auth.login(email.trim(), password)
      if (!result.ok) {
        if (result.migrate) {
          switchMode('migrate', email.trim())
          resetFields()
        } else {
          setError(result.error)
        }
        return
      }
      onSignedIn(result.user, result.authUser)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    if (!targetEmail.trim() || !inviteCode.trim() || !newPassword) return
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true); setError(null)
    try {
      const result = await window.api.auth.activate(targetEmail.trim(), inviteCode.trim(), newPassword)
      if (!result.ok) { setError(result.error); return }
      onSignedIn(result.user, result.authUser)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMigrate = async () => {
    if (!targetEmail.trim() || !newPassword) return
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true); setError(null)
    try {
      const result = await window.api.auth.migrate(targetEmail.trim(), newPassword)
      if (!result.ok) { setError(result.error); return }
      setPendingSignIn({ user: result.user, authUser: result.authUser, recoveryCode: result.recoveryCode })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    if (!targetEmail.trim() || !recoveryCode.trim() || !newPassword) return
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true); setError(null)
    try {
      const result = await window.api.auth.resetWithRecovery(targetEmail.trim(), recoveryCode.trim(), newPassword)
      if (!result.ok) { setError(result.error); return }
      onSignedIn(result.user, result.authUser)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Recovery code display ─────────────────────────────────────────────────

  if (pendingSignIn) {
    return (
      <div className="org-setup-screen">
        <div className="org-setup-card">
          <div className="org-setup-logo">PM</div>
          <h1 className="org-setup-title">Account set up</h1>
          <p className="org-setup-subtitle">Your recovery code</p>
          <RecoveryCodeStep
            code={pendingSignIn.recoveryCode}
            onDone={() => onSignedIn(pendingSignIn.user, pendingSignIn.authUser)}
          />
        </div>
      </div>
    )
  }

  // ── Main screen ───────────────────────────────────────────────────────────

  return (
    <div className="org-setup-screen">
      <div className="org-setup-card">
        <div className="org-setup-logo">PM</div>
        <h1 className="org-setup-title">{org.name}</h1>

        {/* ── Login ── */}
        {mode === 'login' && (
          <>
            <p className="org-setup-subtitle">Sign in to continue.</p>
            <div className="org-setup-step">
              {error && <div className="org-setup-error">{error}</div>}
              <input className="org-setup-input" type="email" placeholder="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()} autoFocus />
              <input className="org-setup-input" type="password" placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                style={{ marginTop: 8 }} />
              <button className="org-setup-btn" onClick={handleLogin}
                disabled={loading || !email.trim() || !password} style={{ marginTop: 16 }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <button className="org-setup-back" onClick={() => switchMode('activate')}>
                  First time? Use invite code
                </button>
                <button className="org-setup-back" onClick={() => switchMode('forgot', email.trim())}>
                  Forgot password?
                </button>
              </div>
              <div className="org-setup-divider">
                <div className="org-setup-divider-line" />
                <span className="org-setup-divider-text">or</span>
                <div className="org-setup-divider-line" />
              </div>
              <button className="org-setup-btn"
                style={{ background: 'transparent', border: '1.5px solid #c3c6d4', color: '#676879' }}
                onClick={onCreateNewOrg} disabled={loading}>
                + Create a new organization
              </button>
            </div>
          </>
        )}

        {/* ── Activate with invite code ── */}
        {mode === 'activate' && (
          <>
            <p className="org-setup-subtitle">Enter your invite code to activate your account.</p>
            <div className="org-setup-step">
              {error && <div className="org-setup-error">{error}</div>}
              <input className="org-setup-input" type="email" placeholder="Your email address"
                value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} autoFocus />
              <input className="org-setup-input" type="text" placeholder="Invite code"
                value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
                style={{ marginTop: 8, fontFamily: 'monospace', letterSpacing: 1 }} />
              <PasswordFields newPassword={newPassword} confirmPassword={confirmPassword}
                onNewPassword={setNewPassword} onConfirm={setConfirmPassword} onSubmit={handleActivate} />
              <button className="org-setup-btn" onClick={handleActivate}
                disabled={loading || !targetEmail.trim() || !inviteCode.trim() || !newPassword || !confirmPassword}
                style={{ marginTop: 16 }}>
                {loading ? 'Activating…' : 'Activate Account'}
              </button>
              <button className="org-setup-back" onClick={() => switchMode('login')}>← Back</button>
            </div>
          </>
        )}

        {/* ── Migrate from Microsoft account ── */}
        {mode === 'migrate' && (
          <>
            <p className="org-setup-subtitle">
              Your account was created with Microsoft sign-in. Set a new password to continue.
            </p>
            <div className="org-setup-step">
              {error && <div className="org-setup-error">{error}</div>}
              <input className="org-setup-input" type="email" placeholder="Your email address"
                value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} autoFocus />
              <PasswordFields newPassword={newPassword} confirmPassword={confirmPassword}
                onNewPassword={setNewPassword} onConfirm={setConfirmPassword} onSubmit={handleMigrate} />
              <button className="org-setup-btn" onClick={handleMigrate}
                disabled={loading || !targetEmail.trim() || !newPassword || !confirmPassword}
                style={{ marginTop: 16 }}>
                {loading ? 'Setting up…' : 'Set Password & Sign In'}
              </button>
              <button className="org-setup-back" onClick={() => switchMode('login')}>← Back</button>
            </div>
          </>
        )}

        {/* ── Forgot password via recovery code ── */}
        {mode === 'forgot' && (
          <>
            <p className="org-setup-subtitle">Enter your recovery code to reset your password.</p>
            <div className="org-setup-step">
              {error && <div className="org-setup-error">{error}</div>}
              <input className="org-setup-input" type="email" placeholder="Your email address"
                value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} autoFocus />
              <input className="org-setup-input" type="text"
                placeholder="Recovery code  (e.g. XXXXXX-XXXXXX-XXXXXX-XXXXXX)"
                value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)}
                style={{ marginTop: 8, fontFamily: 'monospace', letterSpacing: 1 }} />
              <PasswordFields newPassword={newPassword} confirmPassword={confirmPassword}
                onNewPassword={setNewPassword} onConfirm={setConfirmPassword} onSubmit={handleForgot} />
              <button className="org-setup-btn" onClick={handleForgot}
                disabled={loading || !targetEmail.trim() || !recoveryCode.trim() || !newPassword || !confirmPassword}
                style={{ marginTop: 16 }}>
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
              <button className="org-setup-back" onClick={() => switchMode('login')}>← Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SignInView
