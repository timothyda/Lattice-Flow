import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listTaskFiles, addTaskFile, removeTaskFile } from '../db/task_files'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const todoId = Number(req.query.todoId)
  if (!todoId) { res.status(400).json({ error: 'todoId required' }); return }
  res.json(listTaskFiles(todoId))
})

router.post('/', (req, res) => {
  const { todoId, filePath, fileName } = req.body
  if (!todoId || !filePath || !fileName) { res.status(400).json({ error: 'todoId, filePath, fileName required' }); return }
  res.json(addTaskFile(Number(todoId), filePath, fileName))
})

router.delete('/:id', (req, res) => {
  res.json({ ok: removeTaskFile(Number(req.params.id)) })
})

export default router
