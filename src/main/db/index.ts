import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync } from 'fs'

let db: Database.Database | null = null

function dbHasData(dbPath: string): boolean {
  try {
    const tmp = new (require('better-sqlite3') as typeof Database)(dbPath, { readonly: true })
    const row = tmp.prepare("SELECT COUNT(*) as n FROM sqlite_master WHERE type='table' AND name='organizations'").get() as { n: number }
    if (row.n === 0) { tmp.close(); return false }
    const org = tmp.prepare('SELECT COUNT(*) as n FROM organizations').get() as { n: number }
    tmp.close()
    return org.n > 0
  } catch {
    return false
  }
}

function resolveDbPath(): string {
  const userDataDir = app.getPath('userData')
  const currentPath = join(userDataDir, 'opus-flo.db')

  if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true })

  // One-time migration: copy pm-app-v2.db → opus-flo.db on first run after rename.
  if (!existsSync(currentPath)) {
    const prevPath = join(userDataDir, 'pm-app-v2.db')
    const legacyPath = join(app.getPath('appData'), 'pm-app', 'pm-app-v2.db')
    const source = existsSync(prevPath) && dbHasData(prevPath) ? prevPath
                 : existsSync(legacyPath) && dbHasData(legacyPath) ? legacyPath
                 : null
    if (source) {
      try {
        const tmp = new (require('better-sqlite3') as typeof Database)(source)
        tmp.pragma('wal_checkpoint(TRUNCATE)')
        tmp.close()
      } catch { /* non-fatal */ }
      copyFileSync(source, currentPath)
      for (const ext of ['-shm', '-wal']) {
        try { if (existsSync(currentPath + ext)) unlinkSync(currentPath + ext) } catch {}
      }
    }
  }

  return currentPath
}

export function getDb(): Database.Database {
  if (db) return db
  const dbPath = resolveDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  runAlterMigrations(db)
  return db
}

function cols(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
}

function runAlterMigrations(db: Database.Database): void {
  // projects: add due_date, archived_at if missing
  const projCols = cols(db, 'projects')
  if (!projCols.includes('due_date')) {
    db.exec('ALTER TABLE projects ADD COLUMN due_date TEXT')
  }
  if (!projCols.includes('archived_at')) {
    db.exec('ALTER TABLE projects ADD COLUMN archived_at TEXT')
  }

  // clients: add status, archived_at, description, logo_url if missing
  const clientCols2 = cols(db, 'clients')
  if (!clientCols2.includes('status')) {
    db.exec("ALTER TABLE clients ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
  }
  if (!clientCols2.includes('archived_at')) {
    db.exec('ALTER TABLE clients ADD COLUMN archived_at TEXT')
  }
  if (!clientCols2.includes('description')) {
    db.exec('ALTER TABLE clients ADD COLUMN description TEXT')
  }
  if (!clientCols2.includes('logo_url')) {
    db.exec('ALTER TABLE clients ADD COLUMN logo_url TEXT')
  }
  if (!clientCols2.includes('contact_role')) {
    db.exec('ALTER TABLE clients ADD COLUMN contact_role TEXT')
  }

  // todos: add task_status, updated_at, description if missing
  const todoCols = cols(db, 'todos')
  if (!todoCols.includes('task_status')) {
    db.exec("ALTER TABLE todos ADD COLUMN task_status TEXT NOT NULL DEFAULT 'planning'")
  }
  if (!todoCols.includes('updated_at')) {
    db.exec("ALTER TABLE todos ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))")
  }
  if (!todoCols.includes('assigned_to')) {
    db.exec('ALTER TABLE todos ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL')
  }
  if (!todoCols.includes('priority')) {
    db.exec("ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'")
  }
  if (!todoCols.includes('due_date')) {
    db.exec('ALTER TABLE todos ADD COLUMN due_date TEXT')
  }
  if (!todoCols.includes('completed_at')) {
    db.exec('ALTER TABLE todos ADD COLUMN completed_at TEXT')
  }
  if (!todoCols.includes('description')) {
    db.exec("ALTER TABLE todos ADD COLUMN description TEXT NOT NULL DEFAULT ''")
  }

  // users: add in-app auth columns if missing
  const userCols = cols(db, 'users')
  if (!userCols.includes('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT')
  }
  if (!userCols.includes('invite_token')) {
    db.exec('ALTER TABLE users ADD COLUMN invite_token TEXT')
  }
  if (!userCols.includes('invite_expires')) {
    db.exec('ALTER TABLE users ADD COLUMN invite_expires TEXT')
  }
  if (!userCols.includes('must_set_password')) {
    db.exec('ALTER TABLE users ADD COLUMN must_set_password INTEGER NOT NULL DEFAULT 0')
  }
  if (!userCols.includes('failed_attempts')) {
    db.exec('ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0')
  }
  if (!userCols.includes('locked_until')) {
    db.exec('ALTER TABLE users ADD COLUMN locked_until TEXT')
  }
  if (!userCols.includes('last_login')) {
    db.exec('ALTER TABLE users ADD COLUMN last_login TEXT')
  }
  if (!userCols.includes('recovery_code_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN recovery_code_hash TEXT')
  }

  // time_sessions: add todo_id, subtask_title if missing
  const sessionCols = cols(db, 'time_sessions')
  if (!sessionCols.includes('todo_id')) {
    db.exec('ALTER TABLE time_sessions ADD COLUMN todo_id INTEGER REFERENCES todos(id) ON DELETE SET NULL')
  }
  if (!sessionCols.includes('subtask_title')) {
    db.exec('ALTER TABLE time_sessions ADD COLUMN subtask_title TEXT')
  }

  // todos: add task_template_id if missing
  const todoCols2 = cols(db, 'todos')
  if (!todoCols2.includes('task_template_id')) {
    db.exec('ALTER TABLE todos ADD COLUMN task_template_id INTEGER REFERENCES task_templates(id) ON DELETE SET NULL')
  }

  // projects: add project_type if missing
  const projCols2 = cols(db, 'projects')
  if (!projCols2.includes('project_type')) {
    db.exec("ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'other'")
  }

  // todos: add recurring columns if missing
  const todoCols3 = cols(db, 'todos')
  if (!todoCols3.includes('is_recurring')) {
    db.exec('ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0')
  }
  if (!todoCols3.includes('recurrence_frequency')) {
    db.exec('ALTER TABLE todos ADD COLUMN recurrence_frequency TEXT')
  }
  if (!todoCols3.includes('recurrence_next_date')) {
    db.exec('ALTER TABLE todos ADD COLUMN recurrence_next_date TEXT')
  }

  // todos: add start_date if missing
  const todoCols4 = cols(db, 'todos')
  if (!todoCols4.includes('start_date')) {
    db.exec('ALTER TABLE todos ADD COLUMN start_date TEXT')
  }

  // todos: add estimated_minutes if missing
  const todoCols5 = cols(db, 'todos')
  if (!todoCols5.includes('estimated_minutes')) {
    db.exec('ALTER TABLE todos ADD COLUMN estimated_minutes INTEGER')
  }

  // projects: add time_budget_hours if missing
  const projCols3 = cols(db, 'projects')
  if (!projCols3.includes('time_budget_hours')) {
    db.exec('ALTER TABLE projects ADD COLUMN time_budget_hours REAL')
  }

  // New tables (safe to run even if they already exist via IF NOT EXISTS)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_templates (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      project_type     TEXT    NOT NULL,
      title            TEXT    NOT NULL,
      sort_order       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_template_subtasks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      task_template_id INTEGER NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
      title            TEXT    NOT NULL,
      sort_order       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id     INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(todo_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      todo_id         INTEGER REFERENCES todos(id) ON DELETE CASCADE,
      type            TEXT    NOT NULL DEFAULT 'task_complete',
      message         TEXT    NOT NULL,
      read            INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recent_files (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_path   TEXT    NOT NULL,
      file_name   TEXT    NOT NULL,
      accessed_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS role_routing (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role            TEXT    NOT NULL,
      task_status     TEXT    NOT NULL,
      UNIQUE(organization_id, role, task_status)
    );

    CREATE TABLE IF NOT EXISTS client_contacts (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name      TEXT    NOT NULL,
      email     TEXT    NOT NULL,
      role      TEXT
    );

    CREATE TABLE IF NOT EXISTS user_email_prefs (
      user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      task_assigned      INTEGER NOT NULL DEFAULT 1,
      task_complete      INTEGER NOT NULL DEFAULT 1,
      status_change      INTEGER NOT NULL DEFAULT 0,
      meeting_scheduled  INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS project_client_notifications (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      client_contact_id INTEGER NOT NULL REFERENCES client_contacts(id) ON DELETE CASCADE,
      status_update     INTEGER NOT NULL DEFAULT 0,
      new_file          INTEGER NOT NULL DEFAULT 0,
      meeting_scheduled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(project_id, client_contact_id)
    );

    CREATE TABLE IF NOT EXISTS calendar_accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider      TEXT    NOT NULL,
      account_label TEXT    NOT NULL,
      account_email TEXT,
      access_token  TEXT,
      refresh_token TEXT,
      token_expiry  INTEGER,
      caldav_url    TEXT,
      caldav_username TEXT,
      caldav_password TEXT,
      color         TEXT    NOT NULL DEFAULT '#0073ea',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS org_features (
      org_id  INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      feature TEXT    NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (org_id, feature)
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id    INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name  TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comment_reads (
      todo_id      INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_at TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (todo_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS comment_mentions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(comment_id, user_id)
    );
  `)

  // Seed task_assignments for any existing tasks that were in a routable status
  // before the routing system existed. Uses hardcoded defaults matching STATUS_ROUTING.
  db.exec(`
    INSERT OR IGNORE INTO task_assignments (todo_id, user_id)
    SELECT t.id, u.id
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    JOIN users u ON u.organization_id = p.organization_id
    WHERE NOT EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.todo_id = t.id)
      AND (
        (t.task_status = 'ready_for_design' AND u.role IN ('lead_designer', 'designer'))
        OR (t.task_status = 'ready_for_review' AND u.role IN ('lead_designer', 'project_manager'))
        OR (t.task_status = 'pm_in_progress'   AND u.role = 'project_manager')
        OR (t.task_status = 'need_it'           AND u.role = 'it')
        OR (t.task_status = 'hold'              AND u.role IN ('project_manager', 'lead_designer'))
      )
  `)
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    -- Organizations
    CREATE TABLE IF NOT EXISTS organizations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Users (linked to org with role)
    CREATE TABLE IF NOT EXISTS users (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id   INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      ms_user_id        TEXT    NOT NULL UNIQUE,
      display_name      TEXT    NOT NULL,
      email             TEXT    NOT NULL,
      avatar_url        TEXT,
      role              TEXT    NOT NULL DEFAULT 'team_member',
      dashboard_widgets TEXT    NOT NULL DEFAULT '[]',
      created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Clients (first-class entity, owned by org)
    CREATE TABLE IF NOT EXISTS clients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name            TEXT    NOT NULL,
      contact_name    TEXT,
      contact_email   TEXT,
      notes           TEXT,
      status          TEXT    NOT NULL DEFAULT 'active',
      archived_at     TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Projects (linked to client)
    CREATE TABLE IF NOT EXISTS projects (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id       INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      name            TEXT    NOT NULL,
      description     TEXT    NOT NULL DEFAULT '',
      nas_path        TEXT    NOT NULL DEFAULT '',
      status          TEXT    NOT NULL DEFAULT 'active',
      due_date        TEXT,
      archived_at     TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Phases
    CREATE TABLE IF NOT EXISTS phases (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name         TEXT    NOT NULL,
      "order"      INTEGER NOT NULL DEFAULT 0,
      description  TEXT    NOT NULL DEFAULT '',
      planned_start TEXT,
      planned_end   TEXT,
      status        TEXT    NOT NULL DEFAULT 'planning'
    );

    -- Phase date history (audit trail)
    CREATE TABLE IF NOT EXISTS phase_date_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_id   INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
      old_start  TEXT,
      old_end    TEXT,
      new_start  TEXT,
      new_end    TEXT,
      changed_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Meetings
    CREATE TABLE IF NOT EXISTS meetings (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title             TEXT    NOT NULL,
      date              TEXT    NOT NULL,
      recording_path    TEXT,
      calendar_event_id TEXT,
      notes             TEXT
    );

    -- Time sessions
    CREATE TABLE IF NOT EXISTS time_sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      user_name        TEXT    NOT NULL,
      todo_id          INTEGER REFERENCES todos(id) ON DELETE SET NULL,
      started_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      ended_at         TEXT,
      duration_minutes INTEGER,
      note             TEXT
    );

    -- Todos / Tasks (enhanced with status-based routing)
    CREATE TABLE IF NOT EXISTS todos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      phase_id    INTEGER REFERENCES phases(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      priority    TEXT    NOT NULL DEFAULT 'normal',
      due_date    TEXT,
      task_status TEXT    NOT NULL DEFAULT 'planning',
      completed   INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

  `)
}
