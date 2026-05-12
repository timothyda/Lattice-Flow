import { useState, useEffect } from 'react'
import type { Organization, User, OrgFeatureKey, OrgFeatures } from '../../../../shared/types'

interface Props {
  org: Organization
  currentUser: User | null
}

const FEATURES: { key: OrgFeatureKey; label: string; description: string }[] = [
  {
    key: 'time_budgets',
    label: 'Time Budgets',
    description: 'Set estimated hour budgets on projects and track spend against them.',
  },
  {
    key: 'overtime_alerts',
    label: 'Overtime Alerts',
    description: 'Notify project managers when a team member logs more than 8 hours in a day.',
  },
  {
    key: 'gantt_chart',
    label: 'Gantt Chart',
    description: 'Show a Gantt timeline on project pages displaying task start and due dates.',
  },
]

export default function FeaturesTab({ org, currentUser }: Props): JSX.Element {
  const [features, setFeatures] = useState<OrgFeatures | null>(null)
  const [saving, setSaving] = useState<OrgFeatureKey | null>(null)

  const canEdit =
    currentUser?.role === 'admin' || currentUser?.role === 'project_manager'

  useEffect(() => {
    window.api.orgFeatures.get(org.id).then(setFeatures)
  }, [org.id])

  const handleToggle = async (key: OrgFeatureKey) => {
    if (!features || !canEdit) return
    const newVal = !features[key]
    setSaving(key)
    await window.api.orgFeatures.set(org.id, key, newVal)
    setFeatures((prev) => prev ? { ...prev, [key]: newVal } : prev)
    setSaving(null)
  }

  if (!features) {
    return <p className="settings-section-hint">Loading…</p>
  }

  return (
    <div className="settings-section">
      <h4 className="settings-section-title">Feature Toggles</h4>
      <p className="settings-section-hint">
        Enable or disable optional features for your organization.
        {!canEdit && ' Only admins and project managers can change these.'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
        {FEATURES.map(({ key, label, description }) => (
          <div key={key} className="feature-toggle-row">
            <div className="feature-toggle-info">
              <span className="feature-toggle-label">{label}</span>
              <span className="feature-toggle-desc">{description}</span>
            </div>
            <button
              className={`toggle-switch${features[key] ? ' on' : ''}`}
              onClick={() => handleToggle(key)}
              disabled={!canEdit || saving === key}
              aria-pressed={features[key]}
              title={canEdit ? undefined : 'Admin or project manager required'}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
