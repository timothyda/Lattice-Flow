import { getDb } from '.'
import type { OrgFeatureKey, OrgFeatures } from '../shared/types'

const FEATURE_KEYS: OrgFeatureKey[] = ['time_budgets', 'overtime_alerts', 'gantt_chart']

export function getOrgFeatures(orgId: number): OrgFeatures {
  const rows = getDb().prepare('SELECT feature, enabled FROM org_features WHERE org_id = ?').all(orgId) as { feature: string; enabled: number }[]
  const map = Object.fromEntries(rows.map((r) => [r.feature, r.enabled === 1]))
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, map[k] ?? false])) as OrgFeatures
}

export function setOrgFeature(orgId: number, feature: OrgFeatureKey, enabled: boolean): void {
  getDb().prepare(`
    INSERT INTO org_features (org_id, feature, enabled) VALUES (?, ?, ?)
    ON CONFLICT(org_id, feature) DO UPDATE SET enabled = excluded.enabled
  `).run(orgId, feature, enabled ? 1 : 0)
}
