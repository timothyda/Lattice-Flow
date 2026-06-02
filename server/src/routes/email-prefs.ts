import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  listClientContacts, createClientContact, updateClientContact, deleteClientContact,
  getUserEmailPrefs, setUserEmailPrefs,
  listProjectClientNotifications, upsertProjectClientNotification, removeProjectClientNotification, getAvailableContactsForProject
} from '../db/email_prefs'

const router = Router()
router.use(authMiddleware)

// Client contacts
router.get('/contacts/client/:clientId', (req, res) => {
  res.json(listClientContacts(Number(req.params.clientId)))
})

router.post('/contacts', (req, res) => {
  res.json(createClientContact(req.body))
})

router.patch('/contacts/:id', (req, res) => {
  res.json(updateClientContact(Number(req.params.id), req.body) ?? null)
})

router.delete('/contacts/:id', (req, res) => {
  res.json({ ok: deleteClientContact(Number(req.params.id)) })
})

// User email prefs
router.get('/user', (req, res) => {
  res.json(getUserEmailPrefs(req.user!.userId))
})

router.patch('/user', (req, res) => {
  res.json(setUserEmailPrefs(req.user!.userId, req.body))
})

// Project client notifications
router.get('/project/:projectId', (req, res) => {
  res.json(listProjectClientNotifications(Number(req.params.projectId)))
})

router.post('/project/:projectId/contacts/available', (req, res) => {
  const { clientId } = req.body
  res.json(getAvailableContactsForProject(Number(req.params.projectId), Number(clientId)))
})

router.put('/project/:projectId/contact/:contactId', (req, res) => {
  upsertProjectClientNotification(Number(req.params.projectId), Number(req.params.contactId), req.body)
  res.json({ ok: true })
})

router.delete('/project/:projectId/contact/:contactId', (req, res) => {
  removeProjectClientNotification(Number(req.params.projectId), Number(req.params.contactId))
  res.json({ ok: true })
})

export default router
