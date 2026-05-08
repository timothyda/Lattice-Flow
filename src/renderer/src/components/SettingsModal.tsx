import { useState, useEffect } from 'react'
import type { Organization, User } from '../../../shared/types'
import TaskTemplatesTab from './settings/TaskTemplatesTab'
import RolesTab from './settings/RolesTab'
import EmailTab from './settings/EmailTab'
import NotificationsTab from './settings/NotificationsTab'
import CalendarTab from './settings/CalendarTab'

interface Props {
  org: Organization
  currentUser: User | null
  onClose: () => void
  onOrgRenamed: (newName: string) => void
}

interface RecorderStatus {
  modelExists: boolean
  cliExists: boolean
  dllExists: boolean
  folderPath: string
}

type Tab = 'org' | 'transcription' | 'templates' | 'roles' | 'email' | 'notifications' | 'calendar'

export default function SettingsModal({ org, currentUser, onClose, onOrgRenamed }: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('org')
  const [status, setStatus] = useState<RecorderStatus | null>(null)
  const [orgName, setOrgName] = useState(org.name)
  const [orgSaving, setOrgSaving] = useState(false)
  const [orgSaved, setOrgSaved] = useState(false)

  const refresh = () => {
    window.api.recorder.check().then((info) => setStatus({
      modelExists: info.modelExists,
      cliExists: info.cliExists,
      dllExists: (info as any).dllExists ?? false,
      folderPath: info.folderPath
    }))
  }

  useEffect(() => { refresh() }, [])

  const handleRenameOrg = async () => {
    if (!orgName.trim() || orgName.trim() === org.name) return
    setOrgSaving(true)
    await window.api.org.update(org.id, orgName.trim())
    onOrgRenamed(orgName.trim())
    setOrgSaved(true)
    setOrgSaving(false)
    setTimeout(() => setOrgSaved(false), 2000)
  }

  const tabStyle = (t: Tab) => ({
    padding: '6px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 6,
    border: '1.5px solid',
    borderColor: tab === t ? '#0073ea' : 'transparent',
    background: tab === t ? '#e6f2ff' : 'transparent',
    color: tab === t ? '#0073ea' : '#676879',
    fontWeight: tab === t ? 600 : 400,
  } as React.CSSProperties)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-settings" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Settings</h3>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e6e9f0', paddingBottom: 12 }}>
          <button style={tabStyle('org')} onClick={() => setTab('org')}>Organization</button>
          <button style={tabStyle('transcription')} onClick={() => setTab('transcription')}>Transcription</button>
          <button style={tabStyle('templates')} onClick={() => setTab('templates')}>Task Templates</button>
          <button style={tabStyle('roles')} onClick={() => setTab('roles')}>Roles</button>
          <button style={tabStyle('email')} onClick={() => setTab('email')}>Email</button>
          <button style={tabStyle('notifications')} onClick={() => setTab('notifications')}>Notifications</button>
          <button style={tabStyle('calendar')} onClick={() => setTab('calendar')}>Calendar</button>
        </div>

        {/* ── Organization ── */}
        {tab === 'org' && (
          <div className="settings-section">
            <h4 className="settings-section-title">Organization Name</h4>
            <p className="settings-section-hint">The name shown in the sidebar and across the app.</p>
            <div className="settings-row">
              <div className="field field-inline" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => { setOrgName(e.target.value); setOrgSaved(false) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameOrg()}
                  placeholder="Organization name"
                />
              </div>
              <button
                className="btn-primary"
                style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
                onClick={handleRenameOrg}
                disabled={orgSaving || !orgName.trim() || orgName.trim() === org.name}
              >
                {orgSaving ? 'Saving…' : orgSaved ? '✓ Saved' : 'Rename'}
              </button>
            </div>
          </div>
        )}

        {/* ── Transcription ── */}
        {tab === 'transcription' && (
          <div className="settings-section">
            <h4 className="settings-section-title">Transcription Setup</h4>
            <p className="settings-section-hint">
              Files are stored in: <code>{status?.folderPath ?? '…'}</code>
              <button className="settings-open-folder" onClick={() => window.api.recorder.openFolder()}>
                Open folder
              </button>
            </p>

            <div className="settings-status-row">
              <span className={`settings-status-dot${status?.cliExists ? ' ok' : ''}`} />
              <div className="settings-status-info">
                <strong>Whisper CLI</strong> (main.exe)
                <span className={`settings-status-label${status?.cliExists ? ' ok' : ''}`}>
                  {status?.cliExists ? 'Found' : 'Not found'}
                </span>
              </div>
              {!status?.cliExists && (
                <button className="btn-browse" onClick={async () => { await window.api.recorder.importCli(); refresh() }}>Import…</button>
              )}
            </div>

            <div className="settings-status-row">
              <span className={`settings-status-dot${status?.dllExists ? ' ok' : ''}`} />
              <div className="settings-status-info">
                <strong>Whisper.dll</strong>
                <span className={`settings-status-label${status?.dllExists ? ' ok' : ''}`}>
                  {status?.dllExists ? 'Found' : 'Missing — copy Whisper.dll from your cli folder into the whisper folder above'}
                </span>
              </div>
              {!status?.dllExists && (
                <button className="btn-browse" onClick={async () => { await window.api.recorder.importCli(); refresh() }}>
                  Re-import CLI…
                </button>
              )}
            </div>

            <div className="settings-status-row">
              <span className={`settings-status-dot${status?.modelExists ? ' ok' : ''}`} />
              <div className="settings-status-info">
                <strong>Whisper model</strong> (ggml-medium.en.bin)
                <span className={`settings-status-label${status?.modelExists ? ' ok' : ''}`}>
                  {status?.modelExists ? 'Found' : 'Not found — 1.5 GB download required'}
                </span>
              </div>
              {!status?.modelExists && (
                <button className="btn-browse" onClick={async () => { await window.api.recorder.importModel(); refresh() }}>Import…</button>
              )}
            </div>
          </div>
        )}

        {/* ── Task Templates ── */}
        {tab === 'templates' && (
          <div style={{ overflowY: 'auto', maxHeight: '55vh', paddingRight: 4 }}>
            <TaskTemplatesTab org={org} currentUser={currentUser} />
          </div>
        )}

        {/* ── Roles ── */}
        {tab === 'roles' && (
          <div style={{ overflowY: 'auto', maxHeight: '55vh', paddingRight: 4 }}>
            <RolesTab org={org} currentUser={currentUser} />
          </div>
        )}

        {/* ── Email ── */}
        {tab === 'email' && (
          <div style={{ overflowY: 'auto', maxHeight: '55vh', paddingRight: 4 }}>
            <EmailTab />
          </div>
        )}

        {/* ── Notifications ── */}
        {tab === 'notifications' && (
          <div style={{ overflowY: 'auto', maxHeight: '55vh', paddingRight: 4 }}>
            <NotificationsTab currentUser={currentUser} />
          </div>
        )}

        {/* ── Calendar ── */}
        {tab === 'calendar' && (
          <div style={{ overflowY: 'auto', maxHeight: '55vh', paddingRight: 4 }}>
            <CalendarTab currentUser={currentUser} />
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
