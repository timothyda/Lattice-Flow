import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getTemplates, getTemplatesByType, getSubtitlesForTodo, getSubtitlesForTodoByStatus, addSubtask, removeSubtask, addTemplate, removeTemplate } from '../db/task_templates'
import type { ProjectType } from '../shared/types'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(getTemplates(req.user!.orgId))
})

router.get('/by-type/:projectType', (req, res) => {
  res.json(getTemplatesByType(req.user!.orgId, req.params.projectType as ProjectType))
})

router.get('/subtasks/todo/:todoId', (req, res) => {
  res.json(getSubtitlesForTodo(Number(req.params.todoId)))
})

router.get('/subtasks/todo/:todoId/status/:status', (req, res) => {
  res.json(getSubtitlesForTodoByStatus(Number(req.params.todoId), req.params.status))
})

router.post('/', (req, res) => {
  const { projectType, title } = req.body
  res.json(addTemplate(req.user!.orgId, projectType, title))
})

router.delete('/:id', (req, res) => {
  res.json({ ok: removeTemplate(Number(req.params.id)) })
})

router.post('/:templateId/subtasks', (req, res) => {
  res.json(addSubtask(Number(req.params.templateId), req.body.title))
})

router.delete('/subtasks/:id', (req, res) => {
  res.json({ ok: removeSubtask(Number(req.params.id)) })
})

export default router
