import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting, listLinkedMeetings } from '../db/meetings'

const router = Router()
router.use(authMiddleware)

router.get('/project/:projectId', (req, res) => {
  res.json(listMeetings(Number(req.params.projectId)))
})

router.get('/linked', (_req, res) => {
  res.json(listLinkedMeetings())
})

router.get('/:id', (req, res) => {
  const meeting = getMeeting(Number(req.params.id))
  if (!meeting) { res.status(404).json({ error: 'Not found' }); return }
  res.json(meeting)
})

router.post('/', (req, res) => {
  res.json(createMeeting(req.body))
})

router.patch('/:id', (req, res) => {
  res.json(updateMeeting(Number(req.params.id), req.body) ?? null)
})

router.delete('/:id', (req, res) => {
  res.json({ ok: deleteMeeting(Number(req.params.id)) })
})

export default router
