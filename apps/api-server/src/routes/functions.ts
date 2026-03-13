import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /api/admin/functions - List function configs
router.get('/', (req, res) => {
  try {
    const functions = db.prepare('SELECT * FROM function_config ORDER BY function_name').all();
    res.json(functions);
  } catch (error) {
    console.error('List functions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/functions/:name - Update function config
router.put('/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { is_enabled, requires_approval, tier_override } = req.body;

    // Validate tier_override if provided
    if (tier_override !== null && tier_override !== undefined && !['fast', 'standard', 'premium'].includes(tier_override)) {
      return res.status(400).json({ error: 'Invalid tier_override. Must be "fast", "standard", "premium", or null' });
    }

    // Check if function config exists
    const existing = db.prepare('SELECT function_name FROM function_config WHERE function_name = ?').get(name);

    if (existing) {
      // Update existing config
      const updates: string[] = [];
      const values: any[] = [];

      if (is_enabled !== undefined) {
        updates.push('is_enabled = ?');
        values.push(is_enabled ? 1 : 0);
      }
      if (requires_approval !== undefined) {
        updates.push('requires_approval = ?');
        values.push(requires_approval ? 1 : 0);
      }
      if (tier_override !== undefined) {
        updates.push('tier_override = ?');
        values.push(tier_override);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(name);

      const query = `UPDATE function_config SET ${updates.join(', ')} WHERE function_name = ?`;
      db.prepare(query).run(...values);

      // Log audit entry
      const auditId = uuidv4();
      db.prepare(`
        INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
        VALUES (?, ?, ?, 'update', 'function_config', ?, ?)
      `).run(auditId, req.user?.id, req.user?.email, name, JSON.stringify(req.body));
    } else {
      // Create new config
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO function_config (function_name, is_enabled, requires_approval, tier_override, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        name,
        is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1,
        requires_approval !== undefined ? (requires_approval ? 1 : 0) : 1,
        tier_override || null,
        now
      );

      // Log audit entry
      const auditId = uuidv4();
      db.prepare(`
        INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
        VALUES (?, ?, ?, 'create', 'function_config', ?, ?)
      `).run(auditId, req.user?.id, req.user?.email, name, JSON.stringify(req.body));
    }

    const updated = db.prepare('SELECT * FROM function_config WHERE function_name = ?').get(name);
    res.json(updated);
  } catch (error) {
    console.error('Update function config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
