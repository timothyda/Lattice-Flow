import { useState, useEffect, useCallback } from 'react'
import type { Organization, User, UserRole, TaskStatus } from '../../../../shared/types'
import { ROLE_LABELS, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../../../../shared/types'

interface Props {
  org: Organization
  currentUser: User | null
}

// Only these statuses can be configured for routing
const ROUTABLE_STATUSES: TaskStatus[] = [
  'ready_for_design',
  'ready_for_review',
  'need_it',
  'hold',
  'pm_in_progress',
]

// All roles that can appear in routing config
const ALL_ROLES: UserRole[] = [
  'admin',
  'project_manager',
  'creative_director',
  'lead_designer',
  'senior_designer',
  'junior_designer',
  'designer',
  'senior_developer',
  'junior_developer',
  'marketing',
  'account_manager',
  'sales',
  'it',
]

export default function RolesTab({ org, currentUser }: Props): JSX.Element {
  const [routing, setRouting] = useState<Partial<Record<UserRole, TaskStatus[]>>>({})
  const [saving, setSaving] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = currentUser?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    const data = await window.api.roleRouting.getByRole(org.id)
    setRouting(data)
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const handleToggle = async (role: UserRole, status: TaskStatus) => {
    if (!isAdmin) return
    const current = routing[role] ?? []
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]

    setRouting((prev) => ({ ...prev, [role]: updated }))
    setSaving(role)
    try {
      await window.api.roleRouting.setRole(org.id, role, updated)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p style={{ color: '#9699a6', fontSize: 13 }}>Loading…</p>

  return (
    <div>
      <p style={{ fontSize: 13, color: '#676879', marginBottom: 16, lineHeight: 1.6 }}>
        Configure which task statuses automatically route tasks to each role.
        When a task is set to one of these statuses, all users with the matching role will be assigned.
        {!isAdmin && ' Only admins can change routing.'}
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: '#676879', fontWeight: 600, borderBottom: '2px solid #e6e9f0', whiteSpace: 'nowrap' }}>
                Role
              </th>
              {ROUTABLE_STATUSES.map((s) => (
                <th key={s} style={{ padding: '6px 8px', borderBottom: '2px solid #e6e9f0', whiteSpace: 'nowrap' }}>
                  <span style={{
                    display: 'inline-block',
                    background: `${TASK_STATUS_COLORS[s]}18`,
                    color: TASK_STATUS_COLORS[s],
                    border: `1px solid ${TASK_STATUS_COLORS[s]}40`,
                    borderRadius: 20,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {TASK_STATUS_LABELS[s]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_ROLES.map((role, i) => {
              const roleStatuses = routing[role] ?? []
              const isSaving = saving === role
              return (
                <tr key={role} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 500, color: '#323338', whiteSpace: 'nowrap', borderBottom: '1px solid #f0f2f8' }}>
                    {ROLE_LABELS[role]}
                    {isSaving && <span style={{ marginLeft: 6, fontSize: 10, color: '#9699a6' }}>saving…</span>}
                  </td>
                  {ROUTABLE_STATUSES.map((status) => {
                    const active = roleStatuses.includes(status)
                    return (
                      <td key={status} style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #f0f2f8' }}>
                        <button
                          onClick={() => handleToggle(role, status)}
                          disabled={!isAdmin || isSaving}
                          title={active ? `Remove "${TASK_STATUS_LABELS[status]}" routing from ${ROLE_LABELS[role]}` : `Route "${TASK_STATUS_LABELS[status]}" tasks to ${ROLE_LABELS[role]}`}
                          style={{
                            width: 22, height: 22, borderRadius: 4,
                            border: `1.5px solid ${active ? TASK_STATUS_COLORS[status] : '#c3c6d4'}`,
                            background: active ? TASK_STATUS_COLORS[status] : '#fff',
                            cursor: isAdmin ? 'pointer' : 'default',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}
                        >
                          {active && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: '#9699a6', lineHeight: 1.5 }}>
        Note: "In Progress" and "Planning" statuses are not routable — tasks keep their existing assignees or are cleared automatically.
        "Complete" always clears all assignments.
      </p>
    </div>
  )
}
