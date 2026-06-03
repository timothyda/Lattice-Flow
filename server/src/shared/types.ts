// ── Org & Users ───────────────────────────────────────────────────────────────

export type ProjectType = 'website' | 'branding_guidelines' | 'logo' | 'email_marketing' | 'saas' | 'other'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  website:             'Website',
  branding_guidelines: 'Branding Guidelines',
  logo:                'Logo',
  email_marketing:     'Email Marketing',
  saas:                'SaaS',
  other:               'Other',
}

export interface TaskTemplate {
  id: number
  organization_id: number
  project_type: ProjectType
  title: string
  sort_order: number
  subtasks: TaskTemplateSubtask[]
}

export interface TaskTemplateSubtask {
  id: number
  task_template_id: number
  title: string
  sort_order: number
}

export interface Organization {
  id: number
  name: string
  created_at: string
}

export type NewOrganization = Pick<Organization, 'name'>

export type UserRole =
  | 'admin'
  | 'project_manager'
  | 'creative_director'
  | 'lead_designer'
  | 'senior_designer'
  | 'junior_designer'
  | 'designer'
  | 'senior_developer'
  | 'junior_developer'
  | 'marketing'
  | 'account_manager'
  | 'sales'
  | 'it'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:             'Admin',
  project_manager:   'Project Manager',
  creative_director: 'Creative Director',
  lead_designer:     'Lead Designer',
  senior_designer:   'Senior Designer',
  junior_designer:   'Junior Designer',
  designer:          'Designer',
  senior_developer:  'Senior Developer',
  junior_developer:  'Junior Developer',
  marketing:         'Marketing',
  account_manager:   'Account Manager',
  sales:             'Sales',
  it:                'IT',
}

export interface User {
  id: number
  organization_id: number | null
  ms_user_id: string
  display_name: string
  email: string
  avatar_url: string | null
  role: UserRole
  dashboard_widgets: string
  must_set_password: number
  last_login: string | null
  created_at: string
}

export type NewInvitedUser = {
  organization_id: number
  display_name: string
  email: string
  role: UserRole
}

export type UpdateUser = Partial<Pick<User, 'role' | 'dashboard_widgets'>>

// ── Clients ───────────────────────────────────────────────────────────────────

export interface Client {
  id: number
  organization_id: number
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_role: string | null
  notes: string | null
  description: string | null
  logo_url: string | null
  status: string
  archived_at: string | null
  created_at: string
}

export type NewClient = Omit<Client, 'id' | 'created_at' | 'status' | 'archived_at'>
export type UpdateClient = Partial<Pick<Client, 'name' | 'contact_name' | 'contact_email' | 'contact_role' | 'notes' | 'description' | 'logo_url'>>

// ── Projects ──────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'on_hold' | 'complete' | 'archived'

export interface Project {
  id: number
  organization_id: number
  client_id: number | null
  client_name: string | null
  name: string
  description: string
  nas_path: string
  status: ProjectStatus
  project_type: ProjectType
  due_date: string | null
  time_budget_hours: number | null
  archived_at: string | null
  created_at: string
}

export interface ArchivedItem {
  kind: 'client' | 'project'
  id: number
  name: string
  parent_name: string | null
  archived_at: string
  organization_id: number
}

export type NewProject = {
  organization_id: number
  client_id: number | null
  name: string
  description: string
  nas_path: string
  due_date?: string | null
  project_type?: ProjectType
}

export type UpdateProject = Partial<Pick<Project, 'client_id' | 'name' | 'description' | 'nas_path' | 'status' | 'due_date' | 'time_budget_hours'>>

// ── Phases ────────────────────────────────────────────────────────────────────

export interface Phase {
  id: number
  project_id: number
  name: string
  order: number
  description: string
  planned_start: string | null
  planned_end: string | null
  status: 'planning' | 'active' | 'complete'
}

export interface PhaseDateHistory {
  id: number
  phase_id: number
  old_start: string | null
  old_end: string | null
  new_start: string | null
  new_end: string | null
  changed_at: string
}

export type NewPhase = Omit<Phase, 'id'>
export type UpdatePhase = Partial<Pick<Phase, 'name' | 'order' | 'description' | 'planned_start' | 'planned_end' | 'status'>>

// ── Task Status ───────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'planning'
  | 'ready_for_design'
  | 'ready_for_review'
  | 'need_it'
  | 'hold'
  | 'in_progress'
  | 'pm_in_progress'
  | 'complete'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  planning:         'Planning',
  ready_for_design: 'Ready for Design',
  ready_for_review: 'Ready for Review',
  need_it:          'Need IT',
  hold:             'On Hold',
  in_progress:      'In Progress',
  pm_in_progress:   'PM In Progress',
  complete:         'Complete',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  planning:         '#676879',
  ready_for_design: '#0073ea',
  ready_for_review: '#9f57f7',
  need_it:          '#ff7b00',
  hold:             '#e2445c',
  in_progress:      '#00c875',
  pm_in_progress:   '#0073ea',
  complete:         '#00854d',
}

export const STATUS_ROUTING: Partial<Record<TaskStatus, UserRole[]>> = {
  ready_for_design: ['lead_designer', 'designer'],
  ready_for_review: ['lead_designer', 'project_manager'],
  need_it:          ['it'],
  hold:             ['project_manager', 'lead_designer'],
  pm_in_progress:   ['project_manager'],
}

// ── Meetings ──────────────────────────────────────────────────────────────────

export interface Meeting {
  id: number
  project_id: number
  title: string
  date: string
  recording_path: string | null
  calendar_event_id: string | null
  notes: string | null
}

export type NewMeeting = Omit<Meeting, 'id'>
export type UpdateMeeting = Partial<Pick<Meeting, 'title' | 'date' | 'recording_path' | 'calendar_event_id' | 'notes'>>

export interface LinkedMeeting {
  meeting_id: number
  calendar_event_id: string
  project_name: string
}

// ── Todos / Tasks ─────────────────────────────────────────────────────────────

export type TodoPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Todo {
  id: number
  project_id: number
  project_name: string | null
  phase_id: number | null
  assigned_to: number | null
  assigned_name: string | null
  title: string
  description: string
  priority: TodoPriority
  start_date: string | null
  due_date: string | null
  task_status: TaskStatus
  completed: number
  completed_at: string | null
  task_template_id: number | null
  is_recurring: number
  recurrence_frequency: RecurrenceFrequency | null
  recurrence_next_date: string | null
  estimated_minutes: number | null
  linked_file_path: string | null
  file_count: number
  assigned_avatar_url: string | null
  updated_at: string
  created_at: string
}

export type NewTodo = {
  project_id: number
  phase_id?: number | null
  assigned_to?: number | null
  title: string
  description?: string
  priority?: TodoPriority
  start_date?: string | null
  due_date?: string | null
  task_status?: TaskStatus
  task_template_id?: number | null
  is_recurring?: boolean
  recurrence_frequency?: RecurrenceFrequency | null
  estimated_minutes?: number | null
  linked_file_path?: string | null
}

export type UpdateTodo = Partial<Pick<Todo, 'title' | 'description' | 'priority' | 'start_date' | 'due_date' | 'assigned_to' | 'phase_id'>> & {
  is_recurring?: boolean
  recurrence_frequency?: RecurrenceFrequency | null
  estimated_minutes?: number | null
  linked_file_path?: string | null
}

// ── Task Files ────────────────────────────────────────────────────────────────

export interface TaskFile {
  id: number
  todo_id: number
  file_path: string
  file_name: string
  created_at: string
}

// ── Task Assignments ──────────────────────────────────────────────────────────

export interface TaskAssignment {
  id: number
  todo_id: number
  user_id: number
  display_name: string | null
  assigned_at: string
}

// ── Time Sessions ─────────────────────────────────────────────────────────────

export interface TimeSession {
  id: number
  project_id: number
  user_id: number
  user_name: string
  todo_id: number | null
  todo_title: string | null
  subtask_title: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  note: string | null
}

export interface ManualSessionData {
  project_id: number
  user_id: number
  user_name: string
  todo_id?: number | null
  subtask_title?: string | null
  started_at: string
  ended_at: string
  duration_minutes: number
  note: string | null
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType = 'task_complete' | 'status_change' | 'task_assigned' | 'mention'

export interface AppNotification {
  id: number
  organization_id: number
  user_id: number
  todo_id: number | null
  todo_title: string | null
  project_name: string | null
  type: NotificationType
  message: string
  read: number
  created_at: string
}

// ── Recent Files ──────────────────────────────────────────────────────────────

export interface RecentFile {
  id: number
  user_id: number
  project_id: number
  project_name: string | null
  file_path: string
  file_name: string
  accessed_at: string
}

// ── Client Contacts ───────────────────────────────────────────────────────────

export interface ClientContact {
  id: number
  client_id: number
  name: string
  email: string
  role: string | null
}

export type NewClientContact = Omit<ClientContact, 'id'>
export type UpdateClientContact = Partial<Pick<ClientContact, 'name' | 'email' | 'role'>>

// ── Email / Notifications ─────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from_name: string
  from_email: string
}

export interface UserEmailPrefs {
  user_id: number
  task_assigned: boolean
  task_complete: boolean
  status_change: boolean
  meeting_scheduled: boolean
}

export interface ProjectClientNotification {
  id: number
  project_id: number
  client_contact_id: number
  contact_name: string | null
  contact_email: string | null
  status_update: boolean
  new_file: boolean
  meeting_scheduled: boolean
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  name: string
  email: string
}

// ── Org Features ──────────────────────────────────────────────────────────────

export type OrgFeatureKey = 'time_budgets' | 'overtime_alerts' | 'gantt_chart'
export type OrgFeatures = Record<OrgFeatureKey, boolean>

// ── Recurring Tasks ───────────────────────────────────────────────────────────

export type RecurrenceFrequency = 'day' | 'week' | 'biweekly' | 'monthly' | '3months' | '6months' | 'yearly'

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  day:      'Daily',
  week:     'Weekly',
  biweekly: 'Bi-weekly',
  monthly:  'Monthly',
  '3months':'Every 3 months',
  '6months':'Every 6 months',
  yearly:   'Yearly',
}

// ── Task Comments ─────────────────────────────────────────────────────────────

export interface TaskComment {
  id: number
  todo_id: number
  user_id: number
  user_name: string
  content: string
  created_at: string
}

// ── Dashboard Widgets ─────────────────────────────────────────────────────────

export type WidgetId =
  | 'calendar'
  | 'open_tasks'
  | 'completed_tasks'
  | 'all_open_tasks'
  | 'active_timer'
  | 'recent_files'
  | 'upcoming_deadlines'
  | 'team_workload'
  | 'project_summary'
  | 'recent_meetings'
  | 'hours_summary'
  | 'org_stats'
  | 'activity_feed'

export interface WidgetConfig {
  id: WidgetId
  label: string
  roles: UserRole[]
  required?: boolean
}

export const WIDGET_CATALOG: WidgetConfig[] = [
  { id: 'calendar',          label: 'Personal Calendar',   roles: ['admin','project_manager','creative_director','lead_designer','senior_designer','junior_designer','designer','senior_developer','junior_developer','marketing','account_manager','sales','it'], required: true },
  { id: 'open_tasks',        label: 'My Open Tasks',       roles: ['admin','project_manager','creative_director','lead_designer','senior_designer','junior_designer','designer','senior_developer','junior_developer','marketing','account_manager','sales','it'], required: true },
  { id: 'completed_tasks',   label: 'Recently Completed',  roles: ['admin','project_manager','creative_director','lead_designer','senior_designer','junior_designer','designer','senior_developer','junior_developer','marketing','account_manager','sales','it'], required: true },
  { id: 'all_open_tasks',    label: 'All Open Tasks',      roles: ['admin','project_manager','creative_director','lead_designer','senior_designer','junior_designer','designer','senior_developer','junior_developer','marketing','account_manager','sales','it'] },
  { id: 'active_timer',      label: 'Time Tracker',        roles: ['lead_designer','senior_designer','junior_designer','designer','senior_developer','junior_developer','creative_director','marketing','sales','it'] },
  { id: 'recent_files',      label: 'Recent Files',        roles: ['admin','project_manager','creative_director','lead_designer','senior_designer','junior_designer','designer'] },
  { id: 'upcoming_deadlines',label: 'Upcoming Deadlines',  roles: ['admin','project_manager','creative_director','lead_designer','senior_designer'] },
  { id: 'team_workload',     label: 'Team Workload',       roles: ['admin','project_manager','creative_director','lead_designer'] },
  { id: 'project_summary',   label: 'Project Status',      roles: ['admin','project_manager'] },
  { id: 'recent_meetings',   label: 'Recent Meetings',     roles: ['admin','project_manager','creative_director','lead_designer','senior_designer','junior_designer','designer'] },
  { id: 'hours_summary',     label: 'Hours & Billing',     roles: ['admin','project_manager'] },
  { id: 'org_stats',         label: 'Org Overview',        roles: ['admin'] },
  { id: 'activity_feed',     label: 'Team Activity',       roles: ['admin','project_manager','creative_director'] },
]

export const DEFAULT_WIDGETS: Record<UserRole, WidgetId[]> = {
  admin:             ['calendar','open_tasks','completed_tasks','all_open_tasks','org_stats','hours_summary'],
  project_manager:   ['calendar','open_tasks','completed_tasks','all_open_tasks','project_summary','upcoming_deadlines'],
  creative_director: ['calendar','open_tasks','completed_tasks','all_open_tasks','team_workload','recent_files'],
  lead_designer:     ['calendar','open_tasks','completed_tasks','all_open_tasks','active_timer','recent_files'],
  senior_designer:   ['calendar','open_tasks','completed_tasks','all_open_tasks','active_timer','recent_files'],
  junior_designer:   ['calendar','open_tasks','completed_tasks','all_open_tasks','active_timer','recent_files'],
  designer:          ['calendar','open_tasks','completed_tasks','all_open_tasks','active_timer','recent_files'],
  senior_developer:  ['calendar','open_tasks','completed_tasks','all_open_tasks','active_timer'],
  junior_developer:  ['calendar','open_tasks','completed_tasks','all_open_tasks','active_timer'],
  marketing:         ['calendar','open_tasks','completed_tasks','all_open_tasks','active_timer'],
  account_manager:   ['calendar','open_tasks','completed_tasks','all_open_tasks'],
  sales:             ['calendar','open_tasks','completed_tasks','all_open_tasks'],
  it:                ['calendar','open_tasks','completed_tasks','all_open_tasks','active_timer'],
}
