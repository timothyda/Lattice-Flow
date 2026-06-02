import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getAssignmentsForTodo, assignUserToTask, removeUserFromTask } from '../db/task_assignments'
import { broadcast } from '../realtime'

const router = Router()
router.use(authMiddleware)

router.get('/:todoId', (req, res) => {
  res.json(getAssignmentsForTodo(Number(req.params.todoId)))
})

router.post('/', (req, res) => {
  const { todoId, userId } = req.body
  assignUserToTask(Number(todoId), Number(userId))
  broadcast(req.user!.orgId, 'assignment:changed', { todoId, userId, action: 'assigned' })
  res.json({ ok: true })
})

router.delete('/', (req, res) => {
  const { todoId, userId } = req.body
  removeUserFromTask(Number(todoId), Number(userId))
  broadcast(req.user!.orgId, 'assignment:changed', { todoId, userId, action: 'removed' })
  res.json({ ok: true })
})

export default router
