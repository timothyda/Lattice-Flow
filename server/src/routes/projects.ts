import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listProjects, listProjectsByClient, getProject, createProject, updateProject, deleteProject, archiveProject, restoreProject } from '../db/projects'
import { broadcast } from '../realtime'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(listProjects(req.user!.orgId))
})

router.get('/by-client/:clientId', (req, res) => {
  res.json(listProjectsByClient(Number(req.params.clientId)))
})

router.get('/:id', (req, res) => {
  const project = getProject(Number(req.params.id))
  if (!project) { res.status(404).json({ error: 'Not found' }); return }
  res.json(project)
})

router.post('/', (req, res) => {
  const project = createProject({ ...req.body, organization_id: req.user!.orgId })
  broadcast(req.user!.orgId, 'project:created', project)
  res.json(project)
})

router.patch('/:id', (req, res) => {
  const project = updateProject(Number(req.params.id), req.body)
  if (project) broadcast(req.user!.orgId, 'project:updated', project)
  res.json(project ?? null)
})

router.delete('/:id', (req, res) => {
  const ok = deleteProject(Number(req.params.id))
  if (ok) broadcast(req.user!.orgId, 'project:deleted', { id: Number(req.params.id) })
  res.json({ ok })
})

router.post('/:id/archive', (req, res) => {
  const ok = archiveProject(Number(req.params.id))
  if (ok) broadcast(req.user!.orgId, 'project:updated', { id: Number(req.params.id), archived: true })
  res.json({ ok })
})

router.post('/:id/restore', (req, res) => {
  const ok = restoreProject(Number(req.params.id))
  if (ok) broadcast(req.user!.orgId, 'project:updated', { id: Number(req.params.id), archived: false })
  res.json({ ok })
})

export default router
