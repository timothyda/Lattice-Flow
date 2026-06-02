import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { recordFileAccess, listRecentFiles } from '../db/recent_files'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(listRecentFiles(req.user!.userId))
})

router.post('/', (req, res) => {
  const { projectId, filePath, fileName } = req.body
  recordFileAccess(req.user!.userId, Number(projectId), filePath, fileName)
  res.json({ ok: true })
})

export default router
