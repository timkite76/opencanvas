import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /api/admin/audit - List audit log entries with pagination
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const resource_type = req.query.resource_type as string;
    const action = req.query.action as string;

    let query = 'SELECT * FROM audit_log';
    const conditions: string[] = [];
    const params: any[] = [];

    if (resource_type) {
      conditions.push('resource_type = ?');
      params.push(resource_type);
    }

    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const entries = db.prepare(query).all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM audit_log';
    const countParams: any[] = [];

    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      if (resource_type) countParams.push(resource_type);
      if (action) countParams.push(action);
    }

    const total = db.prepare(countQuery).get(...countParams) as { count: number };

    res.json({
      data: entries,
      pagination: {
        limit,
        offset,
        total: total.count,
        hasMore: offset + limit < total.count
      }
    });
  } catch (error) {
    console.error('List audit log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/audit - Record an audit entry
router.post('/', (req, res) => {
  try {
    const {
      actor_id,
      actor_email,
      action,
      resource_type,
      resource_id,
      details
    } = req.body;

    if (!action || !resource_type) {
      return res.status(400).json({ error: 'action and resource_type are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      actor_id || null,
      actor_email || null,
      action,
      resource_type,
      resource_id || null,
      details || null,
      now
    );

    const entry = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(id);
    res.status(201).json(entry);
  } catch (error) {
    console.error('Record audit entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
