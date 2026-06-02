import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listNotifications, getUnreadCount, markRead, markAllRead } from '../db/notifications'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(listNotifications(req.user!.userId))
})

router.get('/unread-count', (req, res) => {
  res.json({ count: getUnreadCount(req.user!.userId) })
})

router.patch('/:id/read', (req, res) => {
  markRead(Number(req.params.id))
  res.json({ ok: true })
})

router.patch('/read-all', (req, res) => {
  markAllRead(req.user!.userId)
  res.json({ ok: true })
})

export default router
