import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /api/admin/settings - Get all settings
router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM system_settings ORDER BY key').all();

    // Convert to key-value object for easier consumption
    const settingsObject: Record<string, any> = {};
    for (const setting of settings as any[]) {
      try {
        // Try to parse JSON values
        settingsObject[setting.key] = JSON.parse(setting.value);
      } catch {
        // If not JSON, use raw value
        settingsObject[setting.key] = setting.value;
      }
    }

    res.json(settingsObject);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/settings/:key - Set a setting
router.put('/:key', (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }

    // Serialize value (convert objects/arrays to JSON)
    let serializedValue: string;
    if (typeof value === 'object') {
      serializedValue = JSON.stringify(value);
    } else {
      serializedValue = String(value);
    }

    // Check if setting exists
    const existing = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(key);

    const now = new Date().toISOString();

    if (existing) {
      // Update existing setting
      db.prepare(`
        UPDATE system_settings
        SET value = ?, updated_at = ?
        WHERE key = ?
      `).run(serializedValue, now, key);

      // Log audit entry
      const auditId = uuidv4();
      db.prepare(`
        INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
        VALUES (?, ?, ?, 'update', 'system_settings', ?, ?)
      `).run(auditId, req.user?.id, req.user?.email, key, JSON.stringify({ value }));
    } else {
      // Create new setting
      db.prepare(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, ?)
      `).run(key, serializedValue, now);

      // Log audit entry
      const auditId = uuidv4();
      db.prepare(`
        INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
        VALUES (?, ?, ?, 'create', 'system_settings', ?, ?)
      `).run(auditId, req.user?.id, req.user?.email, key, JSON.stringify({ value }));
    }

    const updated = db.prepare('SELECT * FROM system_settings WHERE key = ?').get(key) as any;

    // Parse value for response
    let parsedValue;
    try {
      parsedValue = JSON.parse(updated.value);
    } catch {
      parsedValue = updated.value;
    }

    res.json({
      key: updated.key,
      value: parsedValue,
      updated_at: updated.updated_at
    });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
