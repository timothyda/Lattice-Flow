import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listComments, addComment, deleteComment, markCommentsRead, getUnreadCountsForTodos } from '../db/task_comments'
import { broadcast } from '../realtime'

const router = Router()
router.use(authMiddleware)

router.get('/:todoId', (req, res) => {
  res.json(listComments(Number(req.params.todoId)))
})

router.post('/', (req, res) => {
  const { todoId, content } = req.body
  const comment = addComment(Number(todoId), req.user!.userId, req.body.userName ?? 'Unknown', content, req.user!.orgId)
  broadcast(req.user!.orgId, 'comment:new', comment)
  res.json(comment)
})

router.delete('/:id', (req, res) => {
  const ok = deleteComment(Number(req.params.id), req.user!.userId)
  if (ok) broadcast(req.user!.orgId, 'comment:deleted', { id: Number(req.params.id) })
  res.json({ ok })
})

router.patch('/:todoId/read', (req, res) => {
  markCommentsRead(Number(req.params.todoId), req.user!.userId)
  res.json({ ok: true })
})

router.post('/unread-counts', (req, res) => {
  const { todoIds }: { todoIds: number[] } = req.body
  res.json(getUnreadCountsForTodos(todoIds, req.user!.userId))
})

export default router
