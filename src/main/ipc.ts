import { ipcMain, dialog, app } from 'electron'
import { writeFile, readFile, copyFile, mkdir } from 'fs/promises'
import { extname, join } from 'path'
import { getOrganization, createOrganization, updateOrganization, organizationExists } from './db/organizations'
import { listClients, getClient, createClient, updateClient, deleteClient, archiveClient, restoreClient } from './db/clients'
import { listProjects, listProjectsByClient, getProject, createProject, updateProject, deleteProject, archiveProject, restoreProject } from './db/projects'
import { listArchived, searchArchived } from './db/archive'
import { listPhases, getPhase, createPhase, updatePhase, deletePhase, listPhaseHistory } from './db/phases'
import { listMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting, listLinkedMeetings } from './db/meetings'
import { createUser, getUserById, getUserByEmail, listUsers, updateUser, deleteUser, generateInviteToken } from './db/users'
import { clockIn, clockOut, getActiveSessions, getSessionsByProject, getSessionsByTodo, logSessionManually, exportSessionsCSV, deleteSession } from './db/time_sessions'
import { getDb } from './db'
import { getTemplates, getTemplatesByType, getSubtitlesForTodo, addSubtask, removeSubtask, addTemplate, removeTemplate, seedDefaultTemplates } from './db/task_templates'
import { getRoutingByRole, setRoleRouting, seedDefaultRouting } from './db/role_routing'
import { listTodos, createTodo, toggleTodo, updateTodo, deleteTodo, updateTaskStatus, listOpenTodosForUser, listRecentlyCompletedForUser, listAllOpenTasksForOrg, getTodo } from './db/todos'
import { getAssignmentsForTodo, assignUserToTask, removeUserFromTask, getAllOpenTasksForOrg } from './db/task_assignments'
import { listNotifications, getUnreadCount, markRead, markAllRead } from './db/notifications'
import { recordFileAccess, listRecentFiles } from './db/recent_files'
import { checkPath, listDirectory, copyFileWithProgress, makeDirectory, moveFile } from './fs'
import { fetchAllCalendarEvents } from './calendar'
import { connectMicrosoft } from './calendar/providers/microsoft'
import { connectGoogle } from './calendar/providers/google'
import { connectZoom } from './calendar/providers/zoom'
import { testCalDAVConnection } from './calendar/providers/caldav'
import {
  getAccountsByUser, createOAuthAccount, createCalDAVAccount, deleteCalendarAccount, nextAccountColor
} from './db/calendar_accounts'
import type { CalendarProvider } from '../shared/types'
import { getPrefs, setPrefs, getSmtpConfig, setSmtpConfig } from './store'
import { testSmtpConnection, notifyTaskStatusChange, notifyTaskComplete, notifyMeetingScheduled } from './email'
import {
  listClientContacts, createClientContact, updateClientContact, deleteClientContact,
  getUserEmailPrefs, setUserEmailPrefs,
  listProjectClientNotifications, upsertProjectClientNotification, removeProjectClientNotification, getAvailableContactsForProject
} from './db/email_prefs'
import { getAuthStatus, login, logout, getCurrentUser, setupOrg, activateAccount, generateInvite, migrateFromMsal, resetWithRecoveryCode, generateRecoveryCode } from './auth'
import { transcribeRecording, moveRecording } from './whisper'
import {
  getScreenSources, saveRecording,
  getWhisperCliPath, getModelPath,
  modelExists, whisperCliExists, whisperDllExists,
  importModelFile, importWhisperCli,
  openWhisperFolder, getWhisperFolderPath
} from './recorder'
import type {
  NewOrganization,
  NewClient, UpdateClient,
  NewProject, UpdateProject,
  NewPhase, UpdatePhase,
  NewMeeting, UpdateMeeting,
  UpdateUser,
  NewInvitedUser,
  NewTodo, UpdateTodo,
  TaskStatus,
  ManualSessionData,
  ProjectType,
  UserRole,
  SmtpConfig,
  NewClientContact, UpdateClientContact,
  UserEmailPrefs,
} from '../shared/types'

export function registerIpcHandlers(): void {

  // ── Organizations ──────────────────────────────────────────────────────────
  ipcMain.handle('org:get', () => {
    const user = getCurrentUser()
    if (user?.organization_id) {
      const org = getDb()
        .prepare('SELECT * FROM organizations WHERE id = ?')
        .get(user.organization_id)
      if (org) return org
    }
    return getOrganization()
  })
  ipcMain.handle('org:exists', () => organizationExists())
  ipcMain.handle('org:create', (_e, data: NewOrganization) => createOrganization(data))
  ipcMain.handle('org:update', (_e, id: number, name: string) => updateOrganization(id, name))

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
  ipcMain.handle('clients:list', (_e, orgId: number) => listClients(orgId))
  ipcMain.handle('clients:get', (_e, id: number) => getClient(id))
  ipcMain.handle('clients:create', (_e, data: NewClient) => createClient(data))
  ipcMain.handle('clients:update', (_e, id: number, data: UpdateClient) => updateClient(id, data))
  ipcMain.handle('clients:archive', (_e, id: number) => archiveClient(id))
  ipcMain.handle('clients:restore', (_e, id: number) => restoreClient(id))
  ipcMain.handle('clients:delete', (_e, id: number) => deleteClient(id))

  // ── Projects ───────────────────────────────────────────────────────────────
  ipcMain.handle('projects:list', (_e, orgId: number) => listProjects(orgId))
  ipcMain.handle('projects:by-client', (_e, clientId: number) => listProjectsByClient(clientId))
  ipcMain.handle('projects:get', (_e, id: number) => getProject(id))
  ipcMain.handle('projects:create', (_e, data: NewProject) => createProject(data))
  ipcMain.handle('projects:update', (_e, id: number, data: UpdateProject) => updateProject(id, data))
  ipcMain.handle('projects:archive', (_e, id: number) => archiveProject(id))
  ipcMain.handle('projects:restore', (_e, id: number) => restoreProject(id))
  ipcMain.handle('projects:delete', (_e, id: number) => deleteProject(id))

  // ── Archive ────────────────────────────────────────────────────────────────
  ipcMain.handle('archive:list', (_e, orgId: number) => listArchived(orgId))
  ipcMain.handle('archive:search', (_e, orgId: number, query: string) => searchArchived(orgId, query))

  // ── Phases ─────────────────────────────────────────────────────────────────
  ipcMain.handle('phases:list', (_e, projectId: number) => listPhases(projectId))
  ipcMain.handle('phases:get', (_e, id: number) => getPhase(id))
  ipcMain.handle('phases:create', (_e, data: NewPhase) => createPhase(data))
  ipcMain.handle('phases:update', (_e, id: number, data: UpdatePhase) => updatePhase(id, data))
  ipcMain.handle('phases:delete', (_e, id: number) => deletePhase(id))
  ipcMain.handle('phases:history', (_e, phaseId: number) => listPhaseHistory(phaseId))

  // ── Meetings ───────────────────────────────────────────────────────────────
  ipcMain.handle('meetings:list', (_e, projectId: number) => listMeetings(projectId))
  ipcMain.handle('meetings:get', (_e, id: number) => getMeeting(id))
  ipcMain.handle('meetings:create', async (_e, data: NewMeeting) => {
    const meeting = createMeeting(data)
    const project = getDb().prepare('SELECT name FROM projects WHERE id = ?').get(data.project_id) as { name: string } | undefined
    if (project) notifyMeetingScheduled(meeting, project.name, data.project_id).catch(() => {})
    return meeting
  })
  ipcMain.handle('meetings:update', (_e, id: number, data: UpdateMeeting) => updateMeeting(id, data))
  ipcMain.handle('meetings:delete', (_e, id: number) => deleteMeeting(id))
  ipcMain.handle('meetings:list-linked', () => listLinkedMeetings())

  // ── Users ──────────────────────────────────────────────────────────────────
  ipcMain.handle('users:list', (_e, orgId?: number) => listUsers(orgId))
  ipcMain.handle('users:get', (_e, id: number) => getUserById(id))
  ipcMain.handle('users:create-invited', (_e, data: NewInvitedUser) => {
    try {
      if (getUserByEmail(data.email)) {
        return { error: 'A user with that email address already exists.' }
      }
      const user = createUser(data)
      const inviteToken = generateInviteToken(user.id)
      return { user, inviteToken }
    } catch (err) {
      console.error('[users:create-invited]', err)
      return { error: 'Failed to create user. Please try again.' }
    }
  })
  ipcMain.handle('users:update', (_e, id: number, data: UpdateUser) => updateUser(id, data))
  ipcMain.handle('users:delete', (_e, id: number) => deleteUser(id))
  ipcMain.handle('users:update-avatar', async (_e, userId: number, sourcePath: string) => {
    const avatarsDir = join(app.getPath('userData'), 'avatars')
    await mkdir(avatarsDir, { recursive: true })
    const ext = extname(sourcePath) || '.jpg'
    const destPath = join(avatarsDir, `${userId}${ext}`)
    await copyFile(sourcePath, destPath)
    const fileUrl = `file:///${destPath.replace(/\\/g, '/')}`
    getDb().prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(fileUrl, userId)
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId)
  })
  ipcMain.handle('users:update-display-name', (_e, userId: number, displayName: string) => {
    getDb().prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName.trim(), userId)
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId)
  })

  // ── Time sessions ──────────────────────────────────────────────────────────
  ipcMain.handle('time:clock-in', (_e, projectId: number, userId: number, todoId?: number | null) => {
    try { return clockIn(projectId, userId, todoId) }
    catch (err) { console.error('[time:clock-in]', err); throw err }
  })
  ipcMain.handle('time:clock-out', (_e, sessionId: number, note?: string, subtaskTitle?: string | null) => clockOut(sessionId, note, subtaskTitle))
  ipcMain.handle('time:active-sessions', (_e, projectId: number) => getActiveSessions(projectId))
  ipcMain.handle('time:sessions-by-project', (_e, projectId: number) => getSessionsByProject(projectId))
  ipcMain.handle('time:sessions-by-todo', (_e, todoId: number) => getSessionsByTodo(todoId))
  ipcMain.handle('time:log-manual', (_e, data: ManualSessionData) => logSessionManually(data))
  ipcMain.handle('time:delete-session', (_e, id: number) => deleteSession(id))
  ipcMain.handle('time:export-csv', async (_e, projectId: number) => {
    const csv = exportSessionsCSV(projectId)
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
  ipcMain.handle('todos:list', (_e, projectId: number, phaseId?: number | null) => listTodos(projectId, phaseId))
  ipcMain.handle('todos:get', (_e, id: number) => getTodo(id))
  ipcMain.handle('todos:open-for-user', (_e, userId: number) => listOpenTodosForUser(userId))
  ipcMain.handle('todos:completed-for-user', (_e, userId: number, days?: number) => listRecentlyCompletedForUser(userId, days))
  ipcMain.handle('todos:all-open-org', (_e, orgId: number) => listAllOpenTasksForOrg(orgId))
  ipcMain.handle('todos:create', (_e, data: NewTodo) => createTodo(data))
  ipcMain.handle('todos:toggle', (_e, id: number) => toggleTodo(id))
  ipcMain.handle('todos:update', (_e, id: number, data: UpdateTodo) => updateTodo(id, data))
  ipcMain.handle('todos:update-status', async (_e, todoId: number, status: TaskStatus, actingUserId?: number) => {
    const todo = await updateTaskStatus(todoId, status, actingUserId)
    if (todo) {
      const orgId = getDb().prepare('SELECT p.organization_id FROM todos t JOIN projects p ON t.project_id = p.id WHERE t.id = ?')
        .get(todoId) as { organization_id: number } | undefined
      if (orgId) {
        if (status === 'complete') notifyTaskComplete(todo, orgId.organization_id).catch(() => {})
        else notifyTaskStatusChange(todo, status, orgId.organization_id).catch(() => {})
      }
    }
    return todo
  })
  ipcMain.handle('todos:delete', (_e, id: number) => deleteTodo(id))

  // ── Task assignments ───────────────────────────────────────────────────────
  ipcMain.handle('tasks:assignments', (_e, todoId: number) => getAssignmentsForTodo(todoId))
  ipcMain.handle('tasks:assign-user', (_e, todoId: number, userId: number) => assignUserToTask(todoId, userId))
  ipcMain.handle('tasks:remove-user', (_e, todoId: number, userId: number) => removeUserFromTask(todoId, userId))
  ipcMain.handle('tasks:all-open-org', (_e, orgId: number) => getAllOpenTasksForOrg(orgId))

  // ── Notifications ──────────────────────────────────────────────────────────
  ipcMain.handle('notifications:list', (_e, userId: number, limit?: number) => listNotifications(userId, limit))
  ipcMain.handle('notifications:unread-count', (_e, userId: number) => getUnreadCount(userId))
  ipcMain.handle('notifications:mark-read', (_e, id: number) => markRead(id))
  ipcMain.handle('notifications:mark-all-read', (_e, userId: number) => markAllRead(userId))

  // ── Recent files ───────────────────────────────────────────────────────────
  ipcMain.handle('recent-files:record', (_e, userId: number, projectId: number, filePath: string, fileName: string) =>
    recordFileAccess(userId, projectId, filePath, fileName))
  ipcMain.handle('recent-files:list', (_e, userId: number, limit?: number) => listRecentFiles(userId, limit))

  // ── Preferences ────────────────────────────────────────────────────────────
  ipcMain.handle('prefs:get', () => getPrefs())
  ipcMain.handle('prefs:set', (_e, data: Partial<{ lastProjectId: number | null; lastClientId: number | null }>) => setPrefs(data))

  // ── Task templates ─────────────────────────────────────────────────────────
  ipcMain.handle('taskTemplates:list', (_e, orgId: number) => getTemplates(orgId))
  ipcMain.handle('taskTemplates:listByType', (_e, orgId: number, projectType: ProjectType) => getTemplatesByType(orgId, projectType))
  ipcMain.handle('taskTemplates:subtasksForTodo', (_e, todoId: number) => getSubtitlesForTodo(todoId))
  ipcMain.handle('taskTemplates:addSubtask', (_e, templateId: number, title: string) => addSubtask(templateId, title))
  ipcMain.handle('taskTemplates:removeSubtask', (_e, id: number) => removeSubtask(id))
  ipcMain.handle('taskTemplates:addTemplate', (_e, orgId: number, projectType: ProjectType, title: string) => addTemplate(orgId, projectType, title))
  ipcMain.handle('taskTemplates:removeTemplate', (_e, id: number) => removeTemplate(id))

  // Seed default task templates for any org that doesn't have them yet
  try {
    const orgs = getDb().prepare('SELECT id FROM organizations').all() as { id: number }[]
    for (const org of orgs) seedDefaultTemplates(org.id)
  } catch { /* non-fatal */ }

  // ── Role Routing ───────────────────────────────────────────────────────────
  ipcMain.handle('roleRouting:getByRole', (_e, orgId: number) => getRoutingByRole(orgId))
  ipcMain.handle('roleRouting:setRole', (_e, orgId: number, role: UserRole, statuses: TaskStatus[]) =>
    setRoleRouting(orgId, role, statuses))

  // Seed default routing for any org that doesn't have it yet
  try {
    const orgs = getDb().prepare('SELECT id FROM organizations').all() as { id: number }[]
    for (const org of orgs) seedDefaultRouting(org.id)
  } catch { /* non-fatal */ }

  // ── SMTP / Email ───────────────────────────────────────────────────────────
  ipcMain.handle('smtp:get', () => getSmtpConfig())
  ipcMain.handle('smtp:set', (_e, data: Partial<SmtpConfig>) => setSmtpConfig(data))
  ipcMain.handle('smtp:test', () => testSmtpConnection())

  // ── Email Prefs ────────────────────────────────────────────────────────────
  ipcMain.handle('emailPrefs:get', (_e, userId: number) => getUserEmailPrefs(userId))
  ipcMain.handle('emailPrefs:set', (_e, userId: number, prefs: Partial<Omit<UserEmailPrefs, 'user_id'>>) =>
    setUserEmailPrefs(userId, prefs))

  // ── Client Contacts ────────────────────────────────────────────────────────
  ipcMain.handle('clientContacts:list', (_e, clientId: number) => listClientContacts(clientId))
  ipcMain.handle('clientContacts:create', (_e, data: NewClientContact) => createClientContact(data))
  ipcMain.handle('clientContacts:update', (_e, id: number, data: UpdateClientContact) => updateClientContact(id, data))
  ipcMain.handle('clientContacts:delete', (_e, id: number) => deleteClientContact(id))

  // ── Project Client Notifications ───────────────────────────────────────────
  ipcMain.handle('projectNotifications:list', (_e, projectId: number) => listProjectClientNotifications(projectId))
  ipcMain.handle('projectNotifications:upsert', (_e, projectId: number, contactId: number, settings: Record<string, boolean>) =>
    upsertProjectClientNotification(projectId, contactId, settings))
  ipcMain.handle('projectNotifications:remove', (_e, projectId: number, contactId: number) =>
    removeProjectClientNotification(projectId, contactId))
  ipcMain.handle('projectNotifications:availableContacts', (_e, projectId: number, clientId: number) =>
    getAvailableContactsForProject(projectId, clientId))

  // ── Calendar (multi-provider) ──────────────────────────────────────────────
  ipcMain.handle('graph:events', async () => [])  // legacy stub — kept for compatibility

  ipcMain.handle('calendar:get-accounts', (_e, userId: number) => getAccountsByUser(userId))

  ipcMain.handle('calendar:connect', async (_e, userId: number, provider: CalendarProvider) => {
    try {
      const color = nextAccountColor(userId)
      let result: { email: string; label: string; accessToken: string; refreshToken: string; expiryMs: number }

      if (provider === 'microsoft') result = await connectMicrosoft()
      else if (provider === 'google') result = await connectGoogle()
      else if (provider === 'zoom') result = await connectZoom()
      else throw new Error(`Unknown OAuth provider: ${provider}`)

      const account = createOAuthAccount(
        userId, provider, result.label, result.email,
        result.accessToken, result.refreshToken, result.expiryMs, color
      )
      return { ok: true, account }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('calendar:connect-caldav',
    async (_e, userId: number, url: string, username: string, password: string, label: string) => {
      try {
        const test = await testCalDAVConnection(url, username, password)
        if (!test.ok) return { ok: false, error: test.error }
        const color = nextAccountColor(userId)
        const account = createCalDAVAccount(userId, url, username, password, label || test.displayName, color)
        return { ok: true, account }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle('calendar:disconnect', (_e, accountId: number) => deleteCalendarAccount(accountId))

  ipcMain.handle('calendar:fetch-events', async (_e, userId: number, start: string, end: string) => {
    return fetchAllCalendarEvents(userId, start, end)
  })

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
  ipcMain.handle('fs:read-file', (_e, filePath: string) => readFile(filePath, 'utf8'))
  ipcMain.handle('fs:copy-file', async (event, { srcPath, destPath, id }: { srcPath: string; destPath: string; id: string }) => {
    await copyFileWithProgress(srcPath, destPath, (loaded, total) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('fs:copy-progress', { id, loaded, total, done: false })
      }
    })
  })

  // ── Recorder ───────────────────────────────────────────────────────────────
  ipcMain.handle('recorder:get-sources', () => getScreenSources())
  ipcMain.handle('recorder:save', async (_e, buffer: ArrayBuffer, destPath: string) => {
    await saveRecording(buffer, destPath)
  })
  ipcMain.handle('recorder:check', () => ({
    modelExists: modelExists(),
    cliExists: whisperCliExists(),
    dllExists: whisperDllExists(),
    modelPath: getModelPath(),
    cliPath: getWhisperCliPath(),
    folderPath: getWhisperFolderPath()
  }))
  ipcMain.handle('recorder:import-model', () => importModelFile())
  ipcMain.handle('recorder:import-cli', () => importWhisperCli())
  ipcMain.handle('recorder:open-folder', () => openWhisperFolder())

  // ── Whisper ────────────────────────────────────────────────────────────────
  ipcMain.handle('whisper:transcribe', async (_e, recordingPath: string) => {
    return await transcribeRecording(getWhisperCliPath(), getModelPath(), recordingPath)
  })
  ipcMain.handle('whisper:move-recording', async (_e, srcPath: string, destDir: string) => {
    return await moveRecording(srcPath, destDir)
  })
}
