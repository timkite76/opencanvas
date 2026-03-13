import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /api/admin/usage - List usage log entries with pagination
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const entries = db.prepare(`
      SELECT * FROM usage_log
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM usage_log').get() as { count: number };

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
    console.error('List usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/usage/stats - Aggregated usage statistics
router.get('/stats', (req, res) => {
  try {
    // Total tokens and cost
    const totals = db.prepare(`
      SELECT
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        COUNT(*) as total_requests,
        AVG(duration_ms) as avg_duration_ms
      FROM usage_log
    `).get() as any;

    // By provider
    const byProvider = db.prepare(`
      SELECT
        provider,
        COUNT(*) as requests,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost
      FROM usage_log
      GROUP BY provider
      ORDER BY requests DESC
    `).all();

    // By function
    const byFunction = db.prepare(`
      SELECT
        function_name,
        COUNT(*) as requests,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        AVG(duration_ms) as avg_duration_ms
      FROM usage_log
      GROUP BY function_name
      ORDER BY requests DESC
    `).all();

    // By user
    const byUser = db.prepare(`
      SELECT
        user_id,
        COUNT(*) as requests,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost
      FROM usage_log
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY requests DESC
    `).all();

    // By status
    const byStatus = db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM usage_log
      GROUP BY status
    `).all();

    // Recent activity (last 24 hours)
    const recentActivity = db.prepare(`
      SELECT
        COUNT(*) as requests,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost
      FROM usage_log
      WHERE created_at >= datetime('now', '-1 day')
    `).get();

    res.json({
      totals,
      byProvider,
      byFunction,
      byUser,
      byStatus,
      recentActivity
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/usage - Record a usage entry
router.post('/', (req, res) => {
  try {
    const {
      user_id,
      function_name,
      provider,
      model,
      input_tokens = 0,
      output_tokens = 0,
      total_tokens = 0,
      estimated_cost = 0,
      duration_ms = 0,
      status = 'success',
      error_message
    } = req.body;

    if (!function_name || !provider || !model) {
      return res.status(400).json({ error: 'function_name, provider, and model are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO usage_log (
        id, user_id, function_name, provider, model,
        input_tokens, output_tokens, total_tokens,
        estimated_cost, duration_ms, status, error_message, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, user_id || null, function_name, provider, model,
      input_tokens, output_tokens, total_tokens,
      estimated_cost, duration_ms, status, error_message || null, now
    );

    const entry = db.prepare('SELECT * FROM usage_log WHERE id = ?').get(id);
    res.status(201).json(entry);
  } catch (error) {
    console.error('Record usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
