import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// Helper to sanitize user object (remove password_hash)
function sanitizeUser(user: any) {
  const { password_hash, ...sanitized } = user;
  return sanitized;
}

// GET /api/admin/users - List all users
router.get('/', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    res.json(users.map(sanitizeUser));
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users - Create user
router.post('/', (req, res) => {
  try {
    const { email, name, password, role = 'editor' } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Create user
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, email, name, passwordHash, role, now, now);

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, 'create', 'user', ?, ?)
    `).run(auditId, req.user?.id, req.user?.email, id, JSON.stringify({ email, name, role }));

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.status(201).json(sanitizeUser(newUser));
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/users/:id - Update user
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, role, is_active } = req.body;

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (role !== undefined) {
      if (!['admin', 'editor', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, 'update', 'user', ?, ?)
    `).run(auditId, req.user?.id, req.user?.email, id, JSON.stringify(req.body));

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json(sanitizeUser(updatedUser));
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id - Soft delete user
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete by setting is_active to 0
    db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id)
      VALUES (?, ?, ?, 'delete', 'user', ?)
    `).run(auditId, req.user?.id, req.user?.email, id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users/:id/reset-password - Reset password
router.post('/:id/reset-password', (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Update password
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, new Date().toISOString(), id);

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id)
      VALUES (?, ?, ?, 'reset_password', 'user', ?)
    `).run(auditId, req.user?.id, req.user?.email, id);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
