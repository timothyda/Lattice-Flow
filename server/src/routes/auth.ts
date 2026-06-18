import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { login, setupOrg, activateAccount, migrateFromMsal, resetWithRecoveryCode, generateRecoveryCode, generateInvite, refreshToken } from '../auth'
import { organizationExists } from '../db/organizations'

const router = Router()

router.get('/status', (_req, res) => {
  res.json({ exists: organizationExists() })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return }
  const result = await login(email, password)
  if (!result.ok) { res.status(400).json(result); return }
  res.json(result)
})

router.post('/setup', async (req, res) => {
  const { orgName, adminName, email, password } = req.body
  if (!orgName || !adminName || !email || !password) { res.status(400).json({ error: 'All fields required' }); return }
  if (organizationExists()) { res.status(409).json({ error: 'Organization already exists' }); return }
  const result = await setupOrg(orgName, adminName, email, password)
  if (!result.ok) { res.status(400).json(result); return }
  res.json(result)
})

router.post('/activate', async (req, res) => {
  const { email, inviteToken, newPassword } = req.body
  const result = await activateAccount(email, inviteToken, newPassword)
  if (!result.ok) { res.status(400).json(result); return }
  res.json(result)
})

router.post('/migrate-msal', async (req, res) => {
  const { email, newPassword } = req.body
  const result = await migrateFromMsal(email, newPassword)
  if (!result.ok) { res.status(400).json(result); return }
  res.json(result)
})

router.post('/recover', async (req, res) => {
  const { email, code, newPassword } = req.body
  const result = await resetWithRecoveryCode(email, code, newPassword)
  if (!result.ok) { res.status(400).json(result); return }
  res.json(result)
})

router.get('/refresh', authMiddleware, (req, res) => {
  res.json({ token: refreshToken(req.user!) })
})

router.post('/invite/:userId', authMiddleware, (req, res) => {
  res.json({ token: generateInvite(Number(req.params.userId)) })
})

router.post('/recovery-code', authMiddleware, async (req, res) => {
  res.json({ code: await generateRecoveryCode(req.user!.userId) })
})

export default router
