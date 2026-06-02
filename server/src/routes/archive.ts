import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listArchived, searchArchived } from '../db/archive'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(listArchived(req.user!.orgId))
})

router.get('/search', (req, res) => {
  const q = String(req.query.q ?? '')
  res.json(searchArchived(req.user!.orgId, q))
})

export default router
