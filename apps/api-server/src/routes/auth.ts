import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { sessionStore, authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Fetch user from database
    const user = db.prepare('SELECT id, email, name, password_hash, role, is_active FROM users WHERE email = ?').get(email) as any;

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordValid = bcrypt.compareSync(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate session token
    const token = uuidv4();
    sessionStore.set(token, {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id)
      VALUES (?, ?, ?, 'login', 'user', ?)
    `).run(auditId, user.id, user.email, user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.user!.id) as any;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      sessionStore.delete(token);

      // Log audit entry
      const auditId = uuidv4();
      db.prepare(`
        INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id)
        VALUES (?, ?, ?, 'logout', 'user', ?)
      `).run(auditId, req.user!.id, req.user!.email, req.user!.id);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
