import { useState, useEffect } from 'react'
import type { SmtpConfig } from '../../../../shared/types'

const EMPTY: SmtpConfig = {
  host: '', port: 587, secure: false,
  user: '', password: '',
  from_name: '', from_email: ''
}

export default function EmailTab(): JSX.Element {
  const [cfg, setCfg] = useState<SmtpConfig>(EMPTY)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    window.api.smtp.get().then(setCfg)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await window.api.smtp.set(cfg)
    setSaved(true)
    setSaving(false)
    setTestResult(null)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await window.api.smtp.test()
    setTestResult(result)
    setTesting(false)
  }

  const field = (label: string, key: keyof SmtpConfig, type = 'text', placeholder = '') => (
    <div className="field" style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12 }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={cfg[key] as string}
        onChange={(e) => { setCfg((prev) => ({ ...prev, [key]: e.target.value })); setSaved(false); setTestResult(null) }}
      />
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 13, color: '#676879', marginBottom: 16, lineHeight: 1.6 }}>
        Configure the SMTP server used to send email notifications. When using MailPlus on the NAS,
        enter its host/port and credentials here. Leave blank to disable email notifications.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          {field('SMTP Host', 'host', 'text', 'mail.yourserver.local')}
        </div>
        <div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12 }}>Port</label>
            <input
              type="number"
              value={cfg.port}
              onChange={(e) => { setCfg((prev) => ({ ...prev, port: Number(e.target.value) })); setSaved(false) }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
          <input
            id="smtp-secure"
            type="checkbox"
            checked={cfg.secure}
            onChange={(e) => { setCfg((prev) => ({ ...prev, secure: e.target.checked })); setSaved(false) }}
          />
          <label htmlFor="smtp-secure" style={{ fontSize: 12, cursor: 'pointer' }}>Use TLS (port 465)</label>
        </div>

        {field('Username', 'user', 'text', 'user@yourserver.local')}
        {field('Password', 'password', 'password', '••••••••')}

        {field('From Name', 'from_name', 'text', 'Project Manager')}
        {field('From Email', 'from_email', 'email', 'noreply@yourcompany.com')}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
        <button
          className="btn-secondary"
          onClick={handleTest}
          disabled={testing || !cfg.host}
          title={!cfg.host ? 'Enter a host first' : ''}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>

        {testResult && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: testResult.ok ? '#00854d' : '#e2445c'
          }}>
            {testResult.ok ? '✓ Connected successfully' : `✗ ${testResult.error}`}
          </span>
        )}
      </div>
    </div>
  )
}
