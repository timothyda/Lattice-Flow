import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listUsers, getUserById, createUser, updateUser, deleteUser, generateInviteToken } from '../db/users'

const router = Router()
router.use(authMiddleware)

router.get('/me', (req, res) => {
  const user = getUserById(req.user!.userId)
  if (!user) { res.status(404).json({ error: 'Not found' }); return }
  res.json(user)
})

router.get('/', (req, res) => {
  res.json(listUsers(req.user!.orgId))
})

router.get('/:id', (req, res) => {
  const user = getUserById(Number(req.params.id))
  if (!user) { res.status(404).json({ error: 'Not found' }); return }
  res.json(user)
})

router.post('/', (req, res) => {
  const user = createUser({ ...req.body, organization_id: req.user!.orgId })
  const inviteToken = generateInviteToken(user.id)
  res.json({ ...user, inviteToken })
})

router.patch('/:id', (req, res) => {
  res.json(updateUser(Number(req.params.id), req.body) ?? null)
})

router.delete('/:id', (req, res) => {
  res.json({ ok: deleteUser(Number(req.params.id)) })
})

export default router
