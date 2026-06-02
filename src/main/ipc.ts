import { ipcMain, dialog, app } from 'electron'
import { writeFile, copyFile, mkdir } from 'fs/promises'
import { extname, join } from 'path'
import { apiClient, ping, downloadText } from './api-client'
import { getServerUrl, setServerUrl, clearServerUrl } from './connection-store'
import { getConnectionState, resetAndConnect, retryConnection, emitConnectionState } from './ws-client'
import { checkPath, listDirectory, copyFileWithProgress, makeDirectory, moveFile } from './fs'
import { fetchAllCalendarEvents } from './calendar'
import { connectMicrosoft } from './calendar/providers/microsoft'
import { connectGoogle } from './calendar/providers/google'
import { connectZoom } from './calendar/providers/zoom'
import { testCalDAVConnection } from './calendar/providers/caldav'
import { getPrefs, setPrefs, getSmtpConfig, setSmtpConfig } from './store'
import { testSmtpConnection } from './email'
import {
  getAuthStatus, getCurrentUser, login, logout, setupOrg,
  activateAccount, generateInvite, migrateFromMsal,
  resetWithRecoveryCode, generateRecoveryCode
} from './auth'
import {
  getScreenSources, saveRecording,
  getWhisperCliPath, getModelPath,
  modelExists, whisperCliExists, whisperDllExists,
  importModelFile, importWhisperCli,
  openWhisperFolder, getWhisperFolderPath
} from './recorder'
import { transcribeRecording, moveRecording } from './whisper'
import {
  getAccountsByUser, createOAuthAccount, createCalDAVAccount,
  deleteCalendarAccount, nextAccountColor
} from './db/calendar_accounts'
import type { CalendarProvider } from '../shared/types'
import type {
  NewOrganization, NewClient, UpdateClient,
  NewProject, UpdateProject, NewPhase, UpdatePhase,
  NewMeeting, UpdateMeeting, UpdateUser, NewInvitedUser,
  NewTodo, UpdateTodo, TaskStatus, ManualSessionData,
  ProjectType, UserRole, SmtpConfig,
  NewClientContact, UpdateClientContact, UserEmailPrefs,
  OrgFeatureKey, CopyProgress,
} from '../shared/types'

export function registerIpcHandlers(): void {

  // ── Connection ─────────────────────────────────────────────────────────────
  ipcMain.handle('connection:get-url', () => getServerUrl())
  ipcMain.handle('connection:state', () => getConnectionState())

  ipcMain.handle('connection:set-url', async (_e, url: string) => {
    const result = await ping(url)
    if (!result.ok) return result
    setServerUrl(url)
    resetAndConnect()
    return { ok: true }
  })

  ipcMain.handle('connection:clear-url', () => {
    clearServerUrl()
    emitConnectionState('no_server')
    return { ok: true }
  })

  ipcMain.handle('connection:test', (_e, url: string) => ping(url))
  ipcMain.handle('connection:retry', () => { retryConnection(); return { ok: true } })

  // ── Organizations ──────────────────────────────────────────────────────────
  ipcMain.handle('org:get', () => apiClient.get('/org'))
  ipcMain.handle('org:exists', () => apiClient.get('/org/exists').then((r: unknown) => (r as { exists: boolean }).exists))
  ipcMain.handle('org:create', (_e, data: NewOrganization) => apiClient.post('/org', data))
  ipcMain.handle('org:update', (_e, id: number, name: string) => apiClient.patch('/org', { id, name }))

  // ── Auth ───────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:status', () => getAuthStatus())
  ipcMain.handle('auth:current-user', () => getCurrentUser())
  ipcMain.handle('auth:login', async (_e, email: string, password: string) => {
    try { return await login(email, password) }
    catch (err) { console.error('[auth:login]', err); return { ok: false, error: 'Unexpected error.' } }
  })
  ipcMain.handle('auth:logout', () => logout())
  ipcMain.handle('auth:setup-org', async (_e, orgName: string, adminName: string, email: string, password: string) => {
    try { return await setupOrg(orgName, adminName, email, password) }
    catch (err) { console.error('[auth:setup-org]', err); return { ok: false, error: 'Setup failed.' } }
  })
  ipcMain.handle('auth:activate', async (_e, email: string, inviteToken: string, newPassword: string) => {
    try { return await activateAccount(email, inviteToken, newPassword) }
    catch (err) { console.error('[auth:activate]', err); return { ok: false, error: 'Activation failed.' } }
  })
  ipcMain.handle('auth:generate-invite', (_e, userId: number) => {
    try { return generateInvite(userId) }
    catch (err) { console.error('[auth:generate-invite]', err); return null }
  })
  ipcMain.handle('auth:migrate', async (_e, email: string, newPassword: string) => {
    try { return await migrateFromMsal(email, newPassword) }
    catch (err) { console.error('[auth:migrate]', err); return { ok: false, error: 'Migration failed.' } }
  })
  ipcMain.handle('auth:reset-with-recovery', async (_e, email: string, code: string, newPassword: string) => {
    try { return await resetWithRecoveryCode(email, code, newPassword) }
    catch (err) { console.error('[auth:reset-with-recovery]', err); return { ok: false, error: 'Reset failed.' } }
  })
  ipcMain.handle('auth:generate-recovery', async () => {
    try { return await generateRecoveryCode() }
    catch (err) { console.error('[auth:generate-recovery]', err); return null }
  })

  // ── Clients ────────────────────────────────────────────────────────────────
  ipcMain.handle('clients:list', () => apiClient.get('/clients'))
  ipcMain.handle('clients:get', (_e, id: number) => apiClient.get(`/clients/${id}`))
  ipcMain.handle('clients:create', (_e, data: NewClient) => apiClient.post('/clients', data))
  ipcMain.handle('clients:update', (_e, id: number, data: UpdateClient) => apiClient.patch(`/clients/${id}`, data))
  ipcMain.handle('clients:archive', (_e, id: number) => apiClient.post(`/clients/${id}/archive`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('clients:restore', (_e, id: number) => apiClient.post(`/clients/${id}/restore`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('clients:delete', (_e, id: number) => apiClient.delete(`/clients/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))

  // ── Projects ───────────────────────────────────────────────────────────────
  ipcMain.handle('projects:list', () => apiClient.get('/projects'))
  ipcMain.handle('projects:by-client', (_e, clientId: number) => apiClient.get(`/projects/by-client/${clientId}`))
  ipcMain.handle('projects:get', (_e, id: number) => apiClient.get(`/projects/${id}`))
  ipcMain.handle('projects:create', (_e, data: NewProject) => apiClient.post('/projects', data))
  ipcMain.handle('projects:update', (_e, id: number, data: UpdateProject) => apiClient.patch(`/projects/${id}`, data))
  ipcMain.handle('projects:archive', (_e, id: number) => apiClient.post(`/projects/${id}/archive`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('projects:restore', (_e, id: number) => apiClient.post(`/projects/${id}/restore`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('projects:delete', (_e, id: number) => apiClient.delete(`/projects/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))

  // ── Archive ────────────────────────────────────────────────────────────────
  ipcMain.handle('archive:list', () => apiClient.get('/archive'))
  ipcMain.handle('archive:search', (_e, _orgId: number, query: string) => apiClient.get(`/archive/search?q=${encodeURIComponent(query)}`))

  // ── Phases ─────────────────────────────────────────────────────────────────
  ipcMain.handle('phases:list', (_e, projectId: number) => apiClient.get(`/phases/project/${projectId}`))
  ipcMain.handle('phases:get', (_e, id: number) => apiClient.get(`/phases/${id}`))
  ipcMain.handle('phases:create', (_e, data: NewPhase) => apiClient.post('/phases', data))
  ipcMain.handle('phases:update', (_e, id: number, data: UpdatePhase) => apiClient.patch(`/phases/${id}`, data))
  ipcMain.handle('phases:delete', (_e, id: number) => apiClient.delete(`/phases/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('phases:history', (_e, phaseId: number) => apiClient.get(`/phases/${phaseId}/history`))

  // ── Meetings ───────────────────────────────────────────────────────────────
  ipcMain.handle('meetings:list', (_e, projectId: number) => apiClient.get(`/meetings/project/${projectId}`))
  ipcMain.handle('meetings:get', (_e, id: number) => apiClient.get(`/meetings/${id}`))
  ipcMain.handle('meetings:create', (_e, data: NewMeeting) => apiClient.post('/meetings', data))
  ipcMain.handle('meetings:update', (_e, id: number, data: UpdateMeeting) => apiClient.patch(`/meetings/${id}`, data))
  ipcMain.handle('meetings:delete', (_e, id: number) => apiClient.delete(`/meetings/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('meetings:list-linked', () => apiClient.get('/meetings/linked'))

  // ── Users ──────────────────────────────────────────────────────────────────
  ipcMain.handle('users:list', () => apiClient.get('/users'))
  ipcMain.handle('users:get', (_e, id: number) => apiClient.get(`/users/${id}`))
  ipcMain.handle('users:create-invited', async (_e, data: NewInvitedUser) => {
    try { return await apiClient.post('/users', { ...data, must_set_password: 1 }) }
    catch (err) { return { error: (err as Error).message } }
  })
  ipcMain.handle('users:update', (_e, id: number, data: UpdateUser) => apiClient.patch(`/users/${id}`, data))
  ipcMain.handle('users:delete', (_e, id: number) => apiClient.delete(`/users/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('users:update-display-name', async (_e, userId: number, displayName: string) => {
    return apiClient.patch(`/users/${userId}`, { display_name: displayName.trim() })
  })
  ipcMain.handle('users:update-avatar', async (_e, userId: number, sourcePath: string) => {
    // Avatar files stay local; we copy to userData and store a file:// URL on the server
    const avatarsDir = join(app.getPath('userData'), 'avatars')
    await mkdir(avatarsDir, { recursive: true })
    const ext = extname(sourcePath) || '.jpg'
    const destPath = join(avatarsDir, `${userId}${ext}`)
    await copyFile(sourcePath, destPath)
    const fileUrl = `file:///${destPath.replace(/\\/g, '/')}`
    return apiClient.patch(`/users/${userId}`, { avatar_url: fileUrl })
  })

  // ── Time sessions ──────────────────────────────────────────────────────────
  ipcMain.handle('time:clock-in', (_e, projectId: number, _userId: number, todoId?: number | null) =>
    apiClient.post('/sessions/clock-in', { projectId, todoId }))
  ipcMain.handle('time:clock-out', (_e, sessionId: number, note?: string, subtaskTitle?: string | null) =>
    apiClient.post('/sessions/clock-out', { sessionId, note, subtaskTitle }))
  ipcMain.handle('time:active-sessions', (_e, projectId: number) => apiClient.get(`/sessions/active/${projectId}`))
  ipcMain.handle('time:sessions-by-project', (_e, projectId: number) => apiClient.get(`/sessions/project/${projectId}`))
  ipcMain.handle('time:sessions-by-todo', (_e, todoId: number) => apiClient.get(`/sessions/todo/${todoId}`))
  ipcMain.handle('time:log-manual', (_e, data: ManualSessionData) => apiClient.post('/sessions/manual', data))
  ipcMain.handle('time:delete-session', (_e, id: number) => apiClient.delete(`/sessions/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('time:export-csv', async (_e, projectId: number) => {
    const csv = await downloadText(`/sessions/project/${projectId}/csv`)
    const defaultName = `time-export-${new Date().toLocaleDateString('en-CA')}.csv`
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Time Sessions',
      defaultPath: defaultName,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, csv, 'utf8')
    return filePath
  })

  // ── Todos / Tasks ──────────────────────────────────────────────────────────
  ipcMain.handle('todos:list', (_e, projectId: number, phaseId?: number | null) => {
    const params = phaseId != null ? `?phaseId=${phaseId}` : ''
    return apiClient.get(`/todos/project/${projectId}${params}`)
  })
  ipcMain.handle('todos:get', (_e, id: number) => apiClient.get(`/todos/${id}`))
  ipcMain.handle('todos:open-for-user', () => apiClient.get('/todos/open/me'))
  ipcMain.handle('todos:completed-for-user', () => apiClient.get('/todos/completed/me'))
  ipcMain.handle('todos:all-open-org', () => apiClient.get('/todos/open/org'))
  ipcMain.handle('todos:create', (_e, data: NewTodo) => apiClient.post('/todos', data))
  ipcMain.handle('todos:toggle', (_e, id: number) => apiClient.patch(`/todos/${id}/toggle`))
  ipcMain.handle('todos:update', (_e, id: number, data: UpdateTodo) => apiClient.patch(`/todos/${id}`, data))
  ipcMain.handle('todos:update-status', (_e, todoId: number, status: TaskStatus) =>
    apiClient.patch(`/todos/${todoId}/status`, { status }))
  ipcMain.handle('todos:delete', (_e, id: number) => apiClient.delete(`/todos/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))

  // ── Task assignments ───────────────────────────────────────────────────────
  ipcMain.handle('tasks:assignments', (_e, todoId: number) => apiClient.get(`/assignments/${todoId}`))
  ipcMain.handle('tasks:assign-user', (_e, todoId: number, userId: number) => apiClient.post('/assignments', { todoId, userId }))
  ipcMain.handle('tasks:remove-user', (_e, todoId: number, userId: number) => apiClient.delete('/assignments', { todoId, userId }))
  ipcMain.handle('tasks:all-open-org', () => apiClient.get('/todos/open/org'))

  // ── Notifications ──────────────────────────────────────────────────────────
  ipcMain.handle('notifications:list', () => apiClient.get('/notifications'))
  ipcMain.handle('notifications:unread-count', () => apiClient.get('/notifications/unread-count').then((r: unknown) => (r as { count: number }).count))
  ipcMain.handle('notifications:mark-read', (_e, id: number) => apiClient.patch(`/notifications/${id}/read`))
  ipcMain.handle('notifications:mark-all-read', () => apiClient.patch('/notifications/read-all'))

  // ── Recent files ───────────────────────────────────────────────────────────
  ipcMain.handle('recent-files:record', (_e, _userId: number, projectId: number, filePath: string, fileName: string) =>
    apiClient.post('/recent-files', { projectId, filePath, fileName }))
  ipcMain.handle('recent-files:list', () => apiClient.get('/recent-files'))

  // ── Preferences (stay local) ───────────────────────────────────────────────
  ipcMain.handle('prefs:get', () => getPrefs())
  ipcMain.handle('prefs:set', (_e, data: Partial<{ lastProjectId: number | null; lastClientId: number | null }>) => setPrefs(data))

  // ── Task templates ─────────────────────────────────────────────────────────
  ipcMain.handle('taskTemplates:list', () => apiClient.get('/templates'))
  ipcMain.handle('taskTemplates:listByType', (_e, _orgId: number, projectType: ProjectType) => apiClient.get(`/templates/by-type/${projectType}`))
  ipcMain.handle('taskTemplates:subtasksForTodo', (_e, todoId: number) => apiClient.get(`/templates/subtasks/todo/${todoId}`))
  ipcMain.handle('taskTemplates:subtasksForTodoByStatus', (_e, todoId: number, status: string) => apiClient.get(`/templates/subtasks/todo/${todoId}/status/${status}`))
  ipcMain.handle('taskTemplates:addSubtask', (_e, templateId: number, title: string) => apiClient.post(`/templates/${templateId}/subtasks`, { title }))
  ipcMain.handle('taskTemplates:removeSubtask', (_e, id: number) => apiClient.delete(`/templates/subtasks/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('taskTemplates:addTemplate', (_e, _orgId: number, projectType: ProjectType, title: string) => apiClient.post('/templates', { projectType, title }))
  ipcMain.handle('taskTemplates:removeTemplate', (_e, id: number) => apiClient.delete(`/templates/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))

  // ── Role routing ───────────────────────────────────────────────────────────
  ipcMain.handle('roleRouting:getByRole', () => apiClient.get('/routing'))
  ipcMain.handle('roleRouting:setRole', (_e, _orgId: number, role: UserRole, statuses: TaskStatus[]) => apiClient.post('/routing', { role, statuses }))

  // ── SMTP / Email (stays local) ─────────────────────────────────────────────
  ipcMain.handle('smtp:get', () => getSmtpConfig())
  ipcMain.handle('smtp:set', (_e, data: Partial<SmtpConfig>) => setSmtpConfig(data))
  ipcMain.handle('smtp:test', () => testSmtpConnection())

  // ── Email prefs ────────────────────────────────────────────────────────────
  ipcMain.handle('emailPrefs:get', () => apiClient.get('/email-prefs/user'))
  ipcMain.handle('emailPrefs:set', (_e, _userId: number, prefs: Partial<Omit<UserEmailPrefs, 'user_id'>>) =>
    apiClient.patch('/email-prefs/user', prefs))

  // ── Client contacts ────────────────────────────────────────────────────────
  ipcMain.handle('clientContacts:list', (_e, clientId: number) => apiClient.get(`/email-prefs/contacts/client/${clientId}`))
  ipcMain.handle('clientContacts:create', (_e, data: NewClientContact) => apiClient.post('/email-prefs/contacts', data))
  ipcMain.handle('clientContacts:update', (_e, id: number, data: UpdateClientContact) => apiClient.patch(`/email-prefs/contacts/${id}`, data))
  ipcMain.handle('clientContacts:delete', (_e, id: number) => apiClient.delete(`/email-prefs/contacts/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))

  // ── Project client notifications ───────────────────────────────────────────
  ipcMain.handle('projectNotifications:list', (_e, projectId: number) => apiClient.get(`/email-prefs/project/${projectId}`))
  ipcMain.handle('projectNotifications:upsert', (_e, projectId: number, contactId: number, settings: Record<string, boolean>) =>
    apiClient.put(`/email-prefs/project/${projectId}/contact/${contactId}`, settings))
  ipcMain.handle('projectNotifications:remove', (_e, projectId: number, contactId: number) =>
    apiClient.delete(`/email-prefs/project/${projectId}/contact/${contactId}`))
  ipcMain.handle('projectNotifications:availableContacts', (_e, projectId: number, clientId: number) =>
    apiClient.post(`/email-prefs/project/${projectId}/contacts/available`, { clientId }))

  // ── Org features ───────────────────────────────────────────────────────────
  ipcMain.handle('orgFeatures:get', () => apiClient.get('/org-features'))
  ipcMain.handle('orgFeatures:set', (_e, _orgId: number, feature: OrgFeatureKey, enabled: boolean) =>
    apiClient.patch('/org-features', { feature, enabled }))

  // ── Task comments ──────────────────────────────────────────────────────────
  ipcMain.handle('comments:list', (_e, todoId: number) => apiClient.get(`/comments/${todoId}`))
  ipcMain.handle('comments:add', (_e, todoId: number, _userId: number, userName: string, content: string) =>
    apiClient.post('/comments', { todoId, userName, content }))
  ipcMain.handle('comments:delete', (_e, id: number, _userId: number) =>
    apiClient.delete(`/comments/${id}`).then((r: unknown) => (r as { ok: boolean }).ok))
  ipcMain.handle('comments:markRead', (_e, todoId: number) => apiClient.patch(`/comments/${todoId}/read`))
  ipcMain.handle('comments:unreadCounts', (_e, todoIds: number[]) =>
    apiClient.post('/comments/unread-counts', { todoIds }))

  // ── Calendar (stays local — OAuth flows are per-machine) ───────────────────
  ipcMain.handle('graph:events', async () => [])

  ipcMain.handle('calendar:get-accounts', (_e, userId: number) => getAccountsByUser(userId))

  ipcMain.handle('calendar:connect', async (_e, userId: number, provider: CalendarProvider) => {
    try {
      const color = nextAccountColor(userId)
      let result: { email: string; label: string; accessToken: string; refreshToken: string; expiryMs: number }
      if (provider === 'microsoft') result = await connectMicrosoft()
      else if (provider === 'google') result = await connectGoogle()
      else if (provider === 'zoom') result = await connectZoom()
      else throw new Error(`Unknown OAuth provider: ${provider}`)
      const account = createOAuthAccount(userId, provider, result.label, result.email, result.accessToken, result.refreshToken, result.expiryMs, color)
      return { ok: true, account }
    } catch (e) { return { ok: false, error: (e as Error).message } }
  })

  ipcMain.handle('calendar:connect-caldav', async (_e, userId: number, url: string, username: string, password: string, label: string) => {
    try {
      const test = await testCalDAVConnection(url, username, password)
      if (!test.ok) return { ok: false, error: test.error }
      const color = nextAccountColor(userId)
      const account = createCalDAVAccount(userId, url, username, password, label || test.displayName, color)
      return { ok: true, account }
    } catch (e) { return { ok: false, error: (e as Error).message } }
  })

  ipcMain.handle('calendar:disconnect', (_e, accountId: number) => deleteCalendarAccount(accountId))
  ipcMain.handle('calendar:fetch-events', async (_e, userId: number, start: string, end: string) =>
    fetchAllCalendarEvents(userId, start, end))

  // ── Dialog ─────────────────────────────────────────────────────────────────
  ipcMain.handle('dialog:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })
  ipcMain.handle('dialog:pick-files', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    return canceled ? [] : filePaths
  })

  // ── File system ────────────────────────────────────────────────────────────
  ipcMain.handle('fs:check-path', (_e, dirPath: string) => checkPath(dirPath))
  ipcMain.handle('fs:list-dir', (_e, dirPath: string) => listDirectory(dirPath))
  ipcMain.handle('fs:mkdir', (_e, dirPath: string) => makeDirectory(dirPath))
  ipcMain.handle('fs:move-file', (_e, srcPath: string, destDir: string) => moveFile(srcPath, destDir))
  ipcMain.handle('fs:read-file', (_e, filePath: string) => {
    const { readFile } = require('fs/promises') as typeof import('fs/promises')
    return readFile(filePath, 'utf8')
  })
  ipcMain.handle('fs:copy-file', async (event, { srcPath, destPath, id }: { srcPath: string; destPath: string; id: string }) => {
    await copyFileWithProgress(srcPath, destPath, (loaded, total) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('fs:copy-progress', { id, loaded, total, done: false } as CopyProgress)
      }
    })
  })

  // ── Recorder ───────────────────────────────────────────────────────────────
  ipcMain.handle('recorder:get-sources', () => getScreenSources())
  ipcMain.handle('recorder:save', async (_e, buffer: ArrayBuffer, destPath: string) => saveRecording(buffer, destPath))
  ipcMain.handle('recorder:check', () => ({
    modelExists: modelExists(), cliExists: whisperCliExists(), dllExists: whisperDllExists(),
    modelPath: getModelPath(), cliPath: getWhisperCliPath(), folderPath: getWhisperFolderPath()
  }))
  ipcMain.handle('recorder:import-model', () => importModelFile())
  ipcMain.handle('recorder:import-cli', () => importWhisperCli())
  ipcMain.handle('recorder:open-folder', () => openWhisperFolder())

  // ── Whisper ────────────────────────────────────────────────────────────────
  ipcMain.handle('whisper:transcribe', async (_e, recordingPath: string) =>
    transcribeRecording(getWhisperCliPath(), getModelPath(), recordingPath))
  ipcMain.handle('whisper:move-recording', async (_e, srcPath: string, destDir: string) =>
    moveRecording(srcPath, destDir))
}
