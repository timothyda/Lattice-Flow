import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getRoutingByRole, setRoleRouting } from '../db/role_routing'
import type { UserRole, TaskStatus } from '../shared/types'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(getRoutingByRole(req.user!.orgId))
})

router.post('/', (req, res) => {
  const { role, statuses }: { role: UserRole; statuses: TaskStatus[] } = req.body
  setRoleRouting(req.user!.orgId, role, statuses)
  res.json({ ok: true })
})

export default router
