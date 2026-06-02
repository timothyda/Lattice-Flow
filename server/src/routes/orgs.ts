import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getOrganization, createOrganization, updateOrganization, organizationExists } from '../db/organizations'

const router = Router()
router.use(authMiddleware)

router.get('/', (_req, res) => {
  res.json(getOrganization() ?? null)
})

router.get('/exists', (_req, res) => {
  res.json({ exists: organizationExists() })
})

router.post('/', (req, res) => {
  res.json(createOrganization(req.body))
})

router.patch('/', (req, res) => {
  const { id, name } = req.body
  res.json(updateOrganization(id, name) ?? null)
})

export default router
