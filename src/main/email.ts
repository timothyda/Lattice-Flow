import nodemailer from 'nodemailer'
import { getSmtpConfig, smtpConfigured } from './store'
import type { Todo, Meeting } from '../shared/types'
import { TASK_STATUS_LABELS } from '../shared/types'
import { getDb } from './db'
import type { UserEmailPrefs } from '../shared/types'

// ── Transport ─────────────────────────────────────────────────────────────────

function createTransport() {
  const cfg = getSmtpConfig()
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
  })
}

async function send(to: string | string[], subject: string, html: string): Promise<void> {
  if (!smtpConfigured()) return

  const cfg = getSmtpConfig()
  const from = cfg.from_name ? `"${cfg.from_name}" <${cfg.from_email}>` : cfg.from_email

  try {
    const transport = createTransport()
    await transport.sendMail({ from, to, subject, html })
  } catch (err) {
    console.error('[email] send failed:', err)
  }
}

// ── Template ──────────────────────────────────────────────────────────────────

function template(title: string, body: string): string {
  return `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#323338">
  <div style="font-size:18px;font-weight:600;margin-bottom:16px;color:#0073ea">${title}</div>
  <div style="font-size:14px;line-height:1.6">${body}</div>
  <div style="margin-top:24px;font-size:11px;color:#9699a6;border-top:1px solid #e6e9f0;padding-top:12px">
    This is an automated message from your project management app.
  </div>
</div>`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUsersWithPrefs(orgId: number, prefKey: keyof Omit<UserEmailPrefs, 'user_id'>): { email: string }[] {
  return getDb().prepare(`
    SELECT u.email
    FROM users u
    LEFT JOIN user_email_prefs p ON p.user_id = u.id
    WHERE u.organization_id = ?
      AND u.email IS NOT NULL AND u.email != ''
      AND (p.${prefKey} IS NULL OR p.${prefKey} = 1)
  `).all(orgId) as { email: string }[]
}

function getProjectOrgId(projectId: number): number | null {
  const row = getDb().prepare('SELECT organization_id FROM projects WHERE id = ?')
    .get(projectId) as { organization_id: number } | undefined
  return row?.organization_id ?? null
}

// ── Public notification functions ─────────────────────────────────────────────

export async function notifyTaskAssigned(todo: Todo, assignedUserEmail: string): Promise<void> {
  if (!smtpConfigured()) return
  const subject = `Task assigned: ${todo.title}`
  const body = `
    <p>You have been assigned a task.</p>
    <p><strong>${todo.title}</strong><br>
    Project: ${todo.project_name ?? 'Unknown'}</p>
  `
  await send(assignedUserEmail, subject, template('New Task Assigned', body))
}

export async function notifyTaskStatusChange(todo: Todo, newStatus: string, orgId: number): Promise<void> {
  if (!smtpConfigured()) return

  const recipients = getUsersWithPrefs(orgId, 'status_change')
  if (recipients.length === 0) return

  const statusLabel = TASK_STATUS_LABELS[newStatus as keyof typeof TASK_STATUS_LABELS] ?? newStatus
  const subject = `Task status updated: ${todo.title}`
  const body = `
    <p>A task status has changed.</p>
    <p><strong>${todo.title}</strong><br>
    Project: ${todo.project_name ?? 'Unknown'}<br>
    New status: <strong>${statusLabel}</strong></p>
  `
  await send(recipients.map((r) => r.email), subject, template('Task Status Updated', body))

  // Also notify client contacts subscribed to status updates for this project
  await notifyClientContacts(todo.project_id, 'status_update', subject, template('Project Update', body))
}

export async function notifyTaskComplete(todo: Todo, orgId: number): Promise<void> {
  if (!smtpConfigured()) return

  const recipients = getUsersWithPrefs(orgId, 'task_complete')
  if (recipients.length === 0) return

  const subject = `Task completed: ${todo.title}`
  const body = `
    <p>A task has been completed.</p>
    <p><strong>${todo.title}</strong><br>
    Project: ${todo.project_name ?? 'Unknown'}</p>
  `
  await send(recipients.map((r) => r.email), subject, template('Task Completed', body))
}

export async function notifyMeetingScheduled(meeting: Meeting, projectName: string, projectId: number): Promise<void> {
  if (!smtpConfigured()) return

  const orgId = getProjectOrgId(projectId)
  if (!orgId) return

  const recipients = getUsersWithPrefs(orgId, 'meeting_scheduled')
  const date = new Date(meeting.date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const subject = `Meeting scheduled: ${meeting.title}`
  const body = `
    <p>A meeting has been scheduled.</p>
    <p><strong>${meeting.title}</strong><br>
    Project: ${projectName}<br>
    Date: ${date}</p>
  `
  if (recipients.length > 0) {
    await send(recipients.map((r) => r.email), subject, template('Meeting Scheduled', body))
  }

  await notifyClientContacts(projectId, 'meeting_scheduled', subject, template('Meeting Scheduled', body))
}

// Notify client contacts subscribed to a specific event type for a project
async function notifyClientContacts(
  projectId: number,
  eventCol: 'status_update' | 'new_file' | 'meeting_scheduled',
  subject: string,
  html: string
): Promise<void> {
  const contacts = getDb().prepare(`
    SELECT cc.email
    FROM project_client_notifications pcn
    JOIN client_contacts cc ON pcn.client_contact_id = cc.id
    WHERE pcn.project_id = ? AND pcn.${eventCol} = 1
  `).all(projectId) as { email: string }[]

  if (contacts.length > 0) {
    await send(contacts.map((c) => c.email), subject, html)
  }
}

// ── SMTP test ─────────────────────────────────────────────────────────────────

export async function testSmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!smtpConfigured()) return { ok: false, error: 'SMTP not configured.' }
  try {
    const transport = createTransport()
    await transport.verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
