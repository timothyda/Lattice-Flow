import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getOrgFeatures, setOrgFeature } from '../db/org_features'
import type { OrgFeatureKey } from '../shared/types'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(getOrgFeatures(req.user!.orgId))
})

router.patch('/', (req, res) => {
  const { feature, enabled }: { feature: OrgFeatureKey; enabled: boolean } = req.body
  setOrgFeature(req.user!.orgId, feature, enabled)
  res.json({ ok: true })
})

export default router
