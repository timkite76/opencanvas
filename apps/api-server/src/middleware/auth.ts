import { Request, Response, NextFunction } from 'express';
import db from '../db.js';

// In-memory session store
export const sessionStore = new Map<string, { userId: string; email: string; role: string }>();

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  const session = sessionStore.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verify user still exists and is active
  const user = db.prepare('SELECT id, email, name, role, is_active FROM users WHERE id = ? AND is_active = 1').get(session.userId) as any;

  if (!user) {
    sessionStore.delete(token);
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  next();
}

export function internalKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const internalKey = req.headers['x-internal-key'];
  const expectedKey = process.env.INTERNAL_API_KEY || 'internal-dev-key';

  if (internalKey === expectedKey) {
    return next();
  }

  // If internal key doesn't match, fall back to regular auth
  return authMiddleware(req, res, next);
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    next();
  };
}
