import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listPhases, getPhase, createPhase, updatePhase, deletePhase, listPhaseHistory } from '../db/phases'

const router = Router()
router.use(authMiddleware)

router.get('/project/:projectId', (req, res) => {
  res.json(listPhases(Number(req.params.projectId)))
})

router.get('/:id', (req, res) => {
  const phase = getPhase(Number(req.params.id))
  if (!phase) { res.status(404).json({ error: 'Not found' }); return }
  res.json(phase)
})

router.get('/:id/history', (req, res) => {
  res.json(listPhaseHistory(Number(req.params.id)))
})

router.post('/', (req, res) => {
  res.json(createPhase(req.body))
})

router.patch('/:id', (req, res) => {
  res.json(updatePhase(Number(req.params.id), req.body) ?? null)
})

router.delete('/:id', (req, res) => {
  res.json({ ok: deletePhase(Number(req.params.id)) })
})

export default router
