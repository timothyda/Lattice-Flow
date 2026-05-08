import Store from 'electron-store'
import type { SmtpConfig } from '../shared/types'

interface OBSSettings {
  host: string
  port: number
  password: string
}

interface WhisperSettings {
  cliPath: string
  modelPath: string
}

interface StoreSchema {
  lastProjectId: number | null
  lastClientId: number | null
  obsSettings: OBSSettings
  whisperSettings: WhisperSettings
  smtpConfig: SmtpConfig
}

const SMTP_DEFAULTS: SmtpConfig = {
  host: '', port: 587, secure: false,
  user: '', password: '',
  from_name: '', from_email: ''
}

const store = new Store<StoreSchema>({
  defaults: {
    lastProjectId: null,
    lastClientId: null,
    obsSettings: { host: 'localhost', port: 4455, password: '' },
    whisperSettings: { cliPath: '', modelPath: '' },
    smtpConfig: SMTP_DEFAULTS
  }
})

export function getPrefs(): { lastProjectId: number | null; lastClientId: number | null } {
  return {
    lastProjectId: store.get('lastProjectId'),
    lastClientId: store.get('lastClientId')
  }
}

export function setPrefs(prefs: Partial<{ lastProjectId: number | null; lastClientId: number | null }>): void {
  if ('lastProjectId' in prefs) store.set('lastProjectId', prefs.lastProjectId ?? null)
  if ('lastClientId' in prefs) store.set('lastClientId', prefs.lastClientId ?? null)
}

export function getOBSSettings(): OBSSettings {
  return store.get('obsSettings')
}

export function setOBSSettings(s: Partial<OBSSettings>): void {
  store.set('obsSettings', { ...store.get('obsSettings'), ...s })
}

export function getWhisperSettings(): WhisperSettings {
  return store.get('whisperSettings')
}

export function setWhisperSettings(s: Partial<WhisperSettings>): void {
  store.set('whisperSettings', { ...store.get('whisperSettings'), ...s })
}

export function getSmtpConfig(): SmtpConfig {
  return store.get('smtpConfig')
}

export function setSmtpConfig(s: Partial<SmtpConfig>): void {
  store.set('smtpConfig', { ...store.get('smtpConfig'), ...s })
}

export function smtpConfigured(): boolean {
  const cfg = store.get('smtpConfig')
  return !!(cfg.host && cfg.from_email)
}
