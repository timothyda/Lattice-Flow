import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { listClients, getClient, createClient, updateClient, deleteClient, archiveClient, restoreClient } from '../db/clients'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(listClients(req.user!.orgId))
})

router.get('/:id', (req, res) => {
  const client = getClient(Number(req.params.id))
  if (!client) { res.status(404).json({ error: 'Not found' }); return }
  res.json(client)
})

router.post('/', (req, res) => {
  res.json(createClient({ ...req.body, organization_id: req.user!.orgId }))
})

router.patch('/:id', (req, res) => {
  res.json(updateClient(Number(req.params.id), req.body) ?? null)
})

router.delete('/:id', (req, res) => {
  res.json({ ok: deleteClient(Number(req.params.id)) })
})

router.post('/:id/archive', (req, res) => {
  res.json({ ok: archiveClient(Number(req.params.id)) })
})

router.post('/:id/restore', (req, res) => {
  res.json({ ok: restoreClient(Number(req.params.id)) })
})

export default router
