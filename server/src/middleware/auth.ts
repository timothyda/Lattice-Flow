import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../auth'
import type { TokenPayload } from '../auth'

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }
  const payload = verifyToken(header.slice(7))
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }
  req.user = payload
  next()
}
