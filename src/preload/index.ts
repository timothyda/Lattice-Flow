import { contextBridge, ipcRenderer } from 'electron'
import * as nodePath from 'path'
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
  CopyProgress,
  ProjectType,
  UserRole,
  SmtpConfig,
  NewClientContact, UpdateClientContact,
  UserEmailPrefs,
} from '../shared/types'

contextBridge.exposeInMainWorld('api', {
  org: {
    get: () => ipcRenderer.invoke('org:get'),
    exists: (): Promise<boolean> => ipcRenderer.invoke('org:exists'),
    create: (data: NewOrganization) => ipcRenderer.invoke('org:create', data),
    update: (id: number, name: string) => ipcRenderer.invoke('org:update', id, name)
  },
  auth: {
    status: (): Promise<unknown> => ipcRenderer.invoke('auth:status'),
    getCurrentUser: (): Promise<unknown> => ipcRenderer.invoke('auth:current-user'),
    login: (email: string, password: string): Promise<unknown> => ipcRenderer.invoke('auth:login', email, password),
    logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
    setupOrg: (orgName: string, adminName: string, email: string, password: string): Promise<unknown> =>
      ipcRenderer.invoke('auth:setup-org', orgName, adminName, email, password),
    activate: (email: string, inviteToken: string, newPassword: string): Promise<unknown> =>
      ipcRenderer.invoke('auth:activate', email, inviteToken, newPassword),
    generateInvite: (userId: number): Promise<unknown> =>
      ipcRenderer.invoke('auth:generate-invite', userId),
    migrate: (email: string, newPassword: string): Promise<unknown> =>
      ipcRenderer.invoke('auth:migrate', email, newPassword),
    resetWithRecovery: (email: string, code: string, newPassword: string): Promise<unknown> =>
      ipcRenderer.invoke('auth:reset-with-recovery', email, code, newPassword),
    generateRecovery: (): Promise<unknown> =>
      ipcRenderer.invoke('auth:generate-recovery')
  },
  clients: {
    list: (orgId: number): Promise<unknown[]> => ipcRenderer.invoke('clients:list', orgId),
    get: (id: number): Promise<unknown> => ipcRenderer.invoke('clients:get', id),
    create: (data: NewClient): Promise<unknown> => ipcRenderer.invoke('clients:create', data),
    update: (id: number, data: UpdateClient): Promise<unknown> => ipcRenderer.invoke('clients:update', id, data),
    archive: (id: number): Promise<boolean> => ipcRenderer.invoke('clients:archive', id),
    restore: (id: number): Promise<boolean> => ipcRenderer.invoke('clients:restore', id),
    delete: (id: number): Promise<boolean> => ipcRenderer.invoke('clients:delete', id)
  },
  projects: {
    list: (orgId: number): Promise<unknown[]> => ipcRenderer.invoke('projects:list', orgId),
    byClient: (clientId: number): Promise<unknown[]> => ipcRenderer.invoke('projects:by-client', clientId),
    get: (id: number): Promise<unknown> => ipcRenderer.invoke('projects:get', id),
    create: (data: NewProject): Promise<unknown> => ipcRenderer.invoke('projects:create', data),
    update: (id: number, data: UpdateProject): Promise<unknown> => ipcRenderer.invoke('projects:update', id, data),
    archive: (id: number): Promise<boolean> => ipcRenderer.invoke('projects:archive', id),
    restore: (id: number): Promise<boolean> => ipcRenderer.invoke('projects:restore', id),
    delete: (id: number): Promise<boolean> => ipcRenderer.invoke('projects:delete', id)
  },
  archive: {
    list: (orgId: number): Promise<unknown[]> => ipcRenderer.invoke('archive:list', orgId),
    search: (orgId: number, query: string): Promise<unknown[]> => ipcRenderer.invoke('archive:search', orgId, query)
  },
  phases: {
    list: (projectId: number) => ipcRenderer.invoke('phases:list', projectId),
    get: (id: number) => ipcRenderer.invoke('phases:get', id),
    create: (data: NewPhase) => ipcRenderer.invoke('phases:create', data),
    update: (id: number, data: UpdatePhase) => ipcRenderer.invoke('phases:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('phases:delete', id),
    history: (phaseId: number) => ipcRenderer.invoke('phases:history', phaseId)
  },
  meetings: {
    list: (projectId: number) => ipcRenderer.invoke('meetings:list', projectId),
    get: (id: number) => ipcRenderer.invoke('meetings:get', id),
    create: (data: NewMeeting) => ipcRenderer.invoke('meetings:create', data),
    update: (id: number, data: UpdateMeeting) => ipcRenderer.invoke('meetings:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('meetings:delete', id),
    listLinked: () => ipcRenderer.invoke('meetings:list-linked')
  },
  users: {
    list: (orgId?: number): Promise<unknown[]> => ipcRenderer.invoke('users:list', orgId),
    get: (id: number): Promise<unknown> => ipcRenderer.invoke('users:get', id),
    createInvited: (data: NewInvitedUser): Promise<unknown> => ipcRenderer.invoke('users:create-invited', data),
    update: (id: number, data: UpdateUser): Promise<unknown> => ipcRenderer.invoke('users:update', id, data),
    delete: (id: number): Promise<boolean> => ipcRenderer.invoke('users:delete', id),
    updateAvatar: (userId: number, sourcePath: string): Promise<unknown> => ipcRenderer.invoke('users:update-avatar', userId, sourcePath),
    updateDisplayName: (userId: number, displayName: string): Promise<unknown> => ipcRenderer.invoke('users:update-display-name', userId, displayName),
  },
  time: {
    clockIn: (projectId: number, userId: number, todoId?: number | null): Promise<unknown> =>
      ipcRenderer.invoke('time:clock-in', projectId, userId, todoId),
    clockOut: (sessionId: number, note?: string, subtaskTitle?: string | null): Promise<unknown> =>
      ipcRenderer.invoke('time:clock-out', sessionId, note, subtaskTitle),
    getActiveSessions: (projectId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('time:active-sessions', projectId),
    getSessionsByProject: (projectId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('time:sessions-by-project', projectId),
    getSessionsByTodo: (todoId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('time:sessions-by-todo', todoId),
    logManual: (data: ManualSessionData): Promise<unknown> =>
      ipcRenderer.invoke('time:log-manual', data),
    deleteSession: (id: number): Promise<boolean> =>
      ipcRenderer.invoke('time:delete-session', id),
    exportCsv: (projectId: number): Promise<string | null> =>
      ipcRenderer.invoke('time:export-csv', projectId)
  },
  todos: {
    list: (projectId: number, phaseId?: number | null): Promise<unknown[]> =>
      ipcRenderer.invoke('todos:list', projectId, phaseId),
    get: (id: number): Promise<unknown> =>
      ipcRenderer.invoke('todos:get', id),
    openForUser: (userId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('todos:open-for-user', userId),
    completedForUser: (userId: number, days?: number): Promise<unknown[]> =>
      ipcRenderer.invoke('todos:completed-for-user', userId, days),
    allOpenOrg: (orgId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('todos:all-open-org', orgId),
    create: (data: NewTodo): Promise<unknown> =>
      ipcRenderer.invoke('todos:create', data),
    toggle: (id: number): Promise<unknown> =>
      ipcRenderer.invoke('todos:toggle', id),
    update: (id: number, data: UpdateTodo): Promise<unknown> =>
      ipcRenderer.invoke('todos:update', id, data),
    updateStatus: (todoId: number, status: TaskStatus, actingUserId?: number): Promise<unknown> =>
      ipcRenderer.invoke('todos:update-status', todoId, status, actingUserId),
    delete: (id: number): Promise<boolean> =>
      ipcRenderer.invoke('todos:delete', id)
  },
  tasks: {
    assignments: (todoId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('tasks:assignments', todoId),
    assignUser: (todoId: number, userId: number): Promise<void> =>
      ipcRenderer.invoke('tasks:assign-user', todoId, userId),
    removeUser: (todoId: number, userId: number): Promise<void> =>
      ipcRenderer.invoke('tasks:remove-user', todoId, userId),
    allOpenOrg: (orgId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('tasks:all-open-org', orgId)
  },
  notifications: {
    list: (userId: number, limit?: number): Promise<unknown[]> =>
      ipcRenderer.invoke('notifications:list', userId, limit),
    unreadCount: (userId: number): Promise<number> =>
      ipcRenderer.invoke('notifications:unread-count', userId),
    markRead: (id: number): Promise<void> =>
      ipcRenderer.invoke('notifications:mark-read', id),
    markAllRead: (userId: number): Promise<void> =>
      ipcRenderer.invoke('notifications:mark-all-read', userId)
  },
  recentFiles: {
    record: (userId: number, projectId: number, filePath: string, fileName: string): Promise<void> =>
      ipcRenderer.invoke('recent-files:record', userId, projectId, filePath, fileName),
    list: (userId: number, limit?: number): Promise<unknown[]> =>
      ipcRenderer.invoke('recent-files:list', userId, limit)
  },
  prefs: {
    get: (): Promise<{ lastProjectId: number | null; lastClientId: number | null }> =>
      ipcRenderer.invoke('prefs:get'),
    set: (data: Partial<{ lastProjectId: number | null; lastClientId: number | null }>): Promise<void> =>
      ipcRenderer.invoke('prefs:set', data)
  },
  taskTemplates: {
    list: (orgId: number): Promise<unknown[]> => ipcRenderer.invoke('taskTemplates:list', orgId),
    listByType: (orgId: number, projectType: ProjectType): Promise<unknown[]> => ipcRenderer.invoke('taskTemplates:listByType', orgId, projectType),
    subtasksForTodo: (todoId: number): Promise<string[]> => ipcRenderer.invoke('taskTemplates:subtasksForTodo', todoId),
    addSubtask: (templateId: number, title: string): Promise<unknown> => ipcRenderer.invoke('taskTemplates:addSubtask', templateId, title),
    removeSubtask: (id: number): Promise<boolean> => ipcRenderer.invoke('taskTemplates:removeSubtask', id),
    addTemplate: (orgId: number, projectType: ProjectType, title: string): Promise<unknown> => ipcRenderer.invoke('taskTemplates:addTemplate', orgId, projectType, title),
    removeTemplate: (id: number): Promise<boolean> => ipcRenderer.invoke('taskTemplates:removeTemplate', id),
  },
  roleRouting: {
    getByRole: (orgId: number): Promise<unknown> => ipcRenderer.invoke('roleRouting:getByRole', orgId),
    setRole: (orgId: number, role: UserRole, statuses: TaskStatus[]): Promise<void> =>
      ipcRenderer.invoke('roleRouting:setRole', orgId, role, statuses),
  },
  smtp: {
    get: (): Promise<SmtpConfig> => ipcRenderer.invoke('smtp:get'),
    set: (data: Partial<SmtpConfig>): Promise<void> => ipcRenderer.invoke('smtp:set', data),
    test: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('smtp:test'),
  },
  emailPrefs: {
    get: (userId: number): Promise<UserEmailPrefs> => ipcRenderer.invoke('emailPrefs:get', userId),
    set: (userId: number, prefs: Partial<Omit<UserEmailPrefs, 'user_id'>>): Promise<UserEmailPrefs> =>
      ipcRenderer.invoke('emailPrefs:set', userId, prefs),
  },
  clientContacts: {
    list: (clientId: number): Promise<unknown[]> => ipcRenderer.invoke('clientContacts:list', clientId),
    create: (data: NewClientContact): Promise<unknown> => ipcRenderer.invoke('clientContacts:create', data),
    update: (id: number, data: UpdateClientContact): Promise<unknown> => ipcRenderer.invoke('clientContacts:update', id, data),
    delete: (id: number): Promise<boolean> => ipcRenderer.invoke('clientContacts:delete', id),
  },
  projectNotifications: {
    list: (projectId: number): Promise<unknown[]> => ipcRenderer.invoke('projectNotifications:list', projectId),
    upsert: (projectId: number, contactId: number, settings: Record<string, boolean>): Promise<void> =>
      ipcRenderer.invoke('projectNotifications:upsert', projectId, contactId, settings),
    remove: (projectId: number, contactId: number): Promise<void> =>
      ipcRenderer.invoke('projectNotifications:remove', projectId, contactId),
    availableContacts: (projectId: number, clientId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('projectNotifications:availableContacts', projectId, clientId),
  },
  graph: {
    events: (start: string, end: string) => ipcRenderer.invoke('graph:events', start, end)
  },
  calendar: {
    getAccounts: (userId: number): Promise<unknown[]> =>
      ipcRenderer.invoke('calendar:get-accounts', userId),
    connect: (userId: number, provider: string): Promise<unknown> =>
      ipcRenderer.invoke('calendar:connect', userId, provider),
    connectCalDAV: (userId: number, url: string, username: string, password: string, label: string): Promise<unknown> =>
      ipcRenderer.invoke('calendar:connect-caldav', userId, url, username, password, label),
    disconnect: (accountId: number): Promise<boolean> =>
      ipcRenderer.invoke('calendar:disconnect', accountId),
    fetchEvents: (userId: number, start: string, end: string): Promise<unknown[]> =>
      ipcRenderer.invoke('calendar:fetch-events', userId, start, end),
  },
  dialog: {
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pick-folder'),
    pickFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:pick-files')
  },
  fs: {
    checkPath: (dirPath: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:check-path', dirPath),
    listDir: (dirPath: string): Promise<unknown> => ipcRenderer.invoke('fs:list-dir', dirPath),
    mkdir: (dirPath: string): Promise<void> => ipcRenderer.invoke('fs:mkdir', dirPath),
    moveFile: (srcPath: string, destDir: string): Promise<void> => ipcRenderer.invoke('fs:move-file', srcPath, destDir),
    readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:read-file', filePath),
    copyFile: (srcPath: string, destPath: string, id: string): Promise<void> =>
      ipcRenderer.invoke('fs:copy-file', { srcPath, destPath, id }),
    onCopyProgress: (cb: (p: CopyProgress) => void): (() => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (_e: any, p: CopyProgress) => cb(p)
      ipcRenderer.on('fs:copy-progress', handler)
      return () => ipcRenderer.off('fs:copy-progress', handler)
    }
  },
  path: {
    join: (...parts: string[]): string => nodePath.join(...parts),
    dirname: (p: string): string => nodePath.dirname(p),
    basename: (p: string): string => nodePath.basename(p),
    sep: nodePath.sep
  },
  recorder: {
    getSources: (): Promise<{ id: string; name: string; thumbnail: string }[]> =>
      ipcRenderer.invoke('recorder:get-sources'),
    save: (buffer: ArrayBuffer, destPath: string): Promise<void> =>
      ipcRenderer.invoke('recorder:save', buffer, destPath),
    check: (): Promise<{ modelExists: boolean; cliExists: boolean; modelPath: string; cliPath: string; folderPath: string }> =>
      ipcRenderer.invoke('recorder:check'),
    importModel: (): Promise<boolean> => ipcRenderer.invoke('recorder:import-model'),
    importCli: (): Promise<boolean> => ipcRenderer.invoke('recorder:import-cli'),
    openFolder: (): Promise<void> => ipcRenderer.invoke('recorder:open-folder')
  },
  whisper: {
    transcribe: (recordingPath: string): Promise<string> =>
      ipcRenderer.invoke('whisper:transcribe', recordingPath),
    moveRecording: (srcPath: string, destDir: string): Promise<string> =>
      ipcRenderer.invoke('whisper:move-recording', srcPath, destDir),
    onProgress: (cb: (line: string) => void): (() => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (_e: any, line: string) => cb(line)
      ipcRenderer.on('whisper:progress', handler)
      return () => ipcRenderer.off('whisper:progress', handler)
    }
  }
})
