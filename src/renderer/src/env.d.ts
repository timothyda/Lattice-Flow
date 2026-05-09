import type {
  Organization, NewOrganization,
  Client, NewClient, UpdateClient,
  Project, NewProject, UpdateProject,
  Phase, NewPhase, UpdatePhase, PhaseDateHistory,
  Meeting, NewMeeting, UpdateMeeting, LinkedMeeting,
  User, NewInvitedUser, UpdateUser,
  Todo, NewTodo, UpdateTodo, TaskStatus, UserRole,
  TaskAssignment,
  TimeSession, ManualSessionData,
  AppNotification,
  RecentFile, FileEntry, CopyProgress,
  AuthUser,
  ArchivedItem,
  TaskTemplate, TaskTemplateSubtask, ProjectType,
  ClientContact, NewClientContact, UpdateClientContact,
  SmtpConfig, UserEmailPrefs, ProjectClientNotification,
  CalendarAccount, CalendarEvent, CalendarProvider,
} from '../../shared/types'

declare global {
  interface Window {
    api: {
      org: {
        get: () => Promise<Organization | null>
        exists: () => Promise<boolean>
        create: (data: NewOrganization) => Promise<Organization>
        update: (id: number, name: string) => Promise<Organization | undefined>
      }
      auth: {
        status: () => Promise<AuthUser | null>
        getCurrentUser: () => Promise<User | null>
        login: (email: string, password: string) => Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string; migrate?: true }>
        logout: () => Promise<void>
        setupOrg: (orgName: string, adminName: string, email: string, password: string) => Promise<{ ok: true; org: Organization; user: User; authUser: AuthUser; recoveryCode: string } | { ok: false; error: string }>
        activate: (email: string, inviteToken: string, newPassword: string) => Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string }>
        generateInvite: (userId: number) => Promise<string | null>
        migrate: (email: string, newPassword: string) => Promise<{ ok: true; authUser: AuthUser; user: User; recoveryCode: string } | { ok: false; error: string }>
        resetWithRecovery: (email: string, code: string, newPassword: string) => Promise<{ ok: true; authUser: AuthUser; user: User } | { ok: false; error: string }>
        generateRecovery: () => Promise<string | null>
      }
      clients: {
        list: (orgId: number) => Promise<Client[]>
        get: (id: number) => Promise<Client | undefined>
        create: (data: NewClient) => Promise<Client>
        update: (id: number, data: UpdateClient) => Promise<Client | undefined>
        archive: (id: number) => Promise<boolean>
        restore: (id: number) => Promise<boolean>
        delete: (id: number) => Promise<boolean>
      }
      projects: {
        list: (orgId: number) => Promise<Project[]>
        byClient: (clientId: number) => Promise<Project[]>
        get: (id: number) => Promise<Project | undefined>
        create: (data: NewProject) => Promise<Project>
        update: (id: number, data: UpdateProject) => Promise<Project | undefined>
        archive: (id: number) => Promise<boolean>
        restore: (id: number) => Promise<boolean>
        delete: (id: number) => Promise<boolean>
      }
      archive: {
        list: (orgId: number) => Promise<ArchivedItem[]>
        search: (orgId: number, query: string) => Promise<ArchivedItem[]>
      }
      phases: {
        list: (projectId: number) => Promise<Phase[]>
        get: (id: number) => Promise<Phase | undefined>
        create: (data: NewPhase) => Promise<Phase>
        update: (id: number, data: UpdatePhase) => Promise<Phase | undefined>
        delete: (id: number) => Promise<boolean>
        history: (phaseId: number) => Promise<PhaseDateHistory[]>
      }
      meetings: {
        list: (projectId: number) => Promise<Meeting[]>
        get: (id: number) => Promise<Meeting | undefined>
        create: (data: NewMeeting) => Promise<Meeting>
        update: (id: number, data: UpdateMeeting) => Promise<Meeting | undefined>
        delete: (id: number) => Promise<boolean>
        listLinked: () => Promise<LinkedMeeting[]>
      }
      users: {
        list: (orgId?: number) => Promise<User[]>
        get: (id: number) => Promise<User | undefined>
        createInvited: (data: NewInvitedUser) => Promise<{ user: User; inviteToken: string } | { error: string } | null>
        update: (id: number, data: UpdateUser) => Promise<User | undefined>
        delete: (id: number) => Promise<boolean>
        updateAvatar: (userId: number, sourcePath: string) => Promise<User | undefined>
        updateDisplayName: (userId: number, displayName: string) => Promise<User | undefined>
      }
      time: {
        clockIn: (projectId: number, userId: number, todoId?: number | null) => Promise<TimeSession>
        clockOut: (sessionId: number, note?: string, subtaskTitle?: string | null) => Promise<TimeSession | undefined>
        getActiveSessions: (projectId: number) => Promise<TimeSession[]>
        getSessionsByProject: (projectId: number) => Promise<TimeSession[]>
        getSessionsByTodo: (todoId: number) => Promise<TimeSession[]>
        logManual: (data: ManualSessionData) => Promise<TimeSession>
        deleteSession: (id: number) => Promise<boolean>
        exportCsv: (projectId: number) => Promise<string | null>
      }
      todos: {
        list: (projectId: number, phaseId?: number | null) => Promise<Todo[]>
        get: (id: number) => Promise<Todo | undefined>
        openForUser: (userId: number) => Promise<Todo[]>
        completedForUser: (userId: number, days?: number) => Promise<Todo[]>
        allOpenOrg: (orgId: number) => Promise<Todo[]>
        create: (data: NewTodo) => Promise<Todo>
        toggle: (id: number) => Promise<Todo | undefined>
        update: (id: number, data: UpdateTodo) => Promise<Todo | undefined>
        updateStatus: (todoId: number, status: TaskStatus, actingUserId?: number) => Promise<Todo | undefined>
        delete: (id: number) => Promise<boolean>
      }
      tasks: {
        assignments: (todoId: number) => Promise<TaskAssignment[]>
        assignUser: (todoId: number, userId: number) => Promise<void>
        removeUser: (todoId: number, userId: number) => Promise<void>
        allOpenOrg: (orgId: number) => Promise<Todo[]>
      }
      notifications: {
        list: (userId: number, limit?: number) => Promise<AppNotification[]>
        unreadCount: (userId: number) => Promise<number>
        markRead: (id: number) => Promise<void>
        markAllRead: (userId: number) => Promise<void>
      }
      recentFiles: {
        record: (userId: number, projectId: number, filePath: string, fileName: string) => Promise<void>
        list: (userId: number, limit?: number) => Promise<RecentFile[]>
      }
      prefs: {
        get: () => Promise<{ lastProjectId: number | null; lastClientId: number | null }>
        set: (data: Partial<{ lastProjectId: number | null; lastClientId: number | null }>) => Promise<void>
      }
      taskTemplates: {
        list: (orgId: number) => Promise<TaskTemplate[]>
        listByType: (orgId: number, projectType: ProjectType) => Promise<TaskTemplate[]>
        subtasksForTodo: (todoId: number) => Promise<string[]>
        addSubtask: (templateId: number, title: string) => Promise<TaskTemplateSubtask>
        removeSubtask: (id: number) => Promise<boolean>
        addTemplate: (orgId: number, projectType: ProjectType, title: string) => Promise<TaskTemplate>
        removeTemplate: (id: number) => Promise<boolean>
      }
      roleRouting: {
        getByRole: (orgId: number) => Promise<Partial<Record<UserRole, TaskStatus[]>>>
        setRole: (orgId: number, role: UserRole, statuses: TaskStatus[]) => Promise<void>
      }
      smtp: {
        get: () => Promise<SmtpConfig>
        set: (data: Partial<SmtpConfig>) => Promise<void>
        test: () => Promise<{ ok: boolean; error?: string }>
      }
      emailPrefs: {
        get: (userId: number) => Promise<UserEmailPrefs>
        set: (userId: number, prefs: Partial<Omit<UserEmailPrefs, 'user_id'>>) => Promise<UserEmailPrefs>
      }
      clientContacts: {
        list: (clientId: number) => Promise<ClientContact[]>
        create: (data: NewClientContact) => Promise<ClientContact>
        update: (id: number, data: UpdateClientContact) => Promise<ClientContact | undefined>
        delete: (id: number) => Promise<boolean>
      }
      projectNotifications: {
        list: (projectId: number) => Promise<ProjectClientNotification[]>
        upsert: (projectId: number, contactId: number, settings: Record<string, boolean>) => Promise<void>
        remove: (projectId: number, contactId: number) => Promise<void>
        availableContacts: (projectId: number, clientId: number) => Promise<ClientContact[]>
      }
      graph: {
        events: (start: string, end: string) => Promise<CalendarEvent[]>
      }
      calendar: {
        getAccounts: (userId: number) => Promise<CalendarAccount[]>
        connect: (userId: number, provider: CalendarProvider) => Promise<{ ok: true; account: CalendarAccount } | { ok: false; error: string }>
        connectCalDAV: (userId: number, url: string, username: string, password: string, label: string) => Promise<{ ok: true; account: CalendarAccount } | { ok: false; error: string }>
        disconnect: (accountId: number) => Promise<boolean>
        fetchEvents: (userId: number, start: string, end: string) => Promise<CalendarEvent[]>
      }
      fs: {
        checkPath: (dirPath: string) => Promise<{ ok: boolean; error?: string }>
        listDir: (dirPath: string) => Promise<FileEntry[]>
        mkdir: (dirPath: string) => Promise<void>
        moveFile: (srcPath: string, destDir: string) => Promise<void>
        readFile: (filePath: string) => Promise<string>
        copyFile: (srcPath: string, destPath: string, id: string) => Promise<void>
        onCopyProgress: (cb: (p: CopyProgress) => void) => () => void
      }
      path: {
        join: (...parts: string[]) => string
        dirname: (p: string) => string
        basename: (p: string) => string
        sep: string
      }
      dialog: {
        pickFolder: () => Promise<string | null>
        pickFiles: () => Promise<string[]>
      }
      recorder: {
        getSources: () => Promise<{ id: string; name: string; thumbnail: string }[]>
        save: (buffer: ArrayBuffer, destPath: string) => Promise<void>
        check: () => Promise<{ modelExists: boolean; cliExists: boolean; dllExists: boolean; modelPath: string; cliPath: string; folderPath: string }>
        importModel: () => Promise<boolean>
        importCli: () => Promise<boolean>
        openFolder: () => Promise<void>
      }
      whisper: {
        transcribe: (recordingPath: string) => Promise<string>
        moveRecording: (srcPath: string, destDir: string) => Promise<string>
        onProgress: (cb: (line: string) => void) => () => void
      }
    }
  }
}
