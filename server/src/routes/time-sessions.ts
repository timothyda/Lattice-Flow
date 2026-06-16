import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { clockIn, clockOut, getActiveSessions, getSessionsByProject, getSessionsByTodo, logSessionManually, exportSessionsCSV, deleteSession } from '../db/time_sessions'

const router = Router()
router.use(authMiddleware)

router.get('/active/:projectId', (req, res) => {
  res.json(getActiveSessions(Number(req.params.projectId)))
})

router.get('/project/:projectId', (req, res) => {
  res.json(getSessionsByProject(Number(req.params.projectId)))
})

router.get('/todo/:todoId', (req, res) => {
  res.json(getSessionsByTodo(Number(req.params.todoId)))
})

router.get('/project/:projectId/csv', (req, res) => {
  const csv = exportSessionsCSV(Number(req.params.projectId))
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="time-sessions.csv"')
  res.send(csv)
})

router.post('/clock-in', (req, res) => {
  const { projectId, todoId } = req.body
  res.json(clockIn(Number(projectId), req.user!.userId, todoId ?? null))
})

router.post('/clock-out', (req, res) => {
  const { sessionId, note, subtaskTitle, deductMinutes } = req.body
  res.json(clockOut(Number(sessionId), note, subtaskTitle, deductMinutes ? Number(deductMinutes) : undefined) ?? null)
})

router.post('/manual', (req, res) => {
  res.json(logSessionManually({ ...req.body, user_id: req.user!.userId }))
})

router.delete('/:id', (req, res) => {
  res.json({ ok: deleteSession(Number(req.params.id)) })
})

export default router
