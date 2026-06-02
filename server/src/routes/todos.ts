import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listTodos, getTodo, createTodo, toggleTodo, updateTodo, deleteTodo, updateTaskStatus, listOpenTodosForUser, listRecentlyCompletedForUser, listAllOpenTasksForOrg } from '../db/todos'
import { broadcast } from '../realtime'

const router = Router()
router.use(authMiddleware)

router.get('/project/:projectId', (req, res) => {
  const phaseId = req.query.phaseId !== undefined ? Number(req.query.phaseId) : undefined
  res.json(listTodos(Number(req.params.projectId), phaseId))
})

router.get('/open/me', (req, res) => {
  res.json(listOpenTodosForUser(req.user!.userId))
})

router.get('/open/org', (req, res) => {
  res.json(listAllOpenTasksForOrg(req.user!.orgId))
})

router.get('/completed/me', (req, res) => {
  res.json(listRecentlyCompletedForUser(req.user!.userId))
})

router.get('/:id', (req, res) => {
  const todo = getTodo(Number(req.params.id))
  if (!todo) { res.status(404).json({ error: 'Not found' }); return }
  res.json(todo)
})

router.post('/', (req, res) => {
  const todo = createTodo(req.body)
  broadcast(req.user!.orgId, 'task:created', todo)
  res.json(todo)
})

router.patch('/:id/toggle', (req, res) => {
  const todo = toggleTodo(Number(req.params.id))
  if (todo) broadcast(req.user!.orgId, 'task:updated', todo)
  res.json(todo ?? null)
})

router.patch('/:id/status', (req, res) => {
  const todo = updateTaskStatus(Number(req.params.id), req.body.status, req.user!.userId)
  if (todo) broadcast(req.user!.orgId, 'task:updated', todo)
  res.json(todo ?? null)
})

router.patch('/:id', (req, res) => {
  const todo = updateTodo(Number(req.params.id), req.body)
  if (todo) broadcast(req.user!.orgId, 'task:updated', todo)
  res.json(todo ?? null)
})

router.delete('/:id', (req, res) => {
  const ok = deleteTodo(Number(req.params.id))
  if (ok) broadcast(req.user!.orgId, 'task:deleted', { id: Number(req.params.id) })
  res.json({ ok })
})

export default router
