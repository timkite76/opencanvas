import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /api/admin/models - List model configs per tier
router.get('/', (req, res) => {
  try {
    const models = db.prepare(`
      SELECT
        mc.*,
        lp.provider,
        lp.display_name as provider_display_name
      FROM model_config mc
      LEFT JOIN llm_providers lp ON mc.provider_id = lp.id
      ORDER BY
        CASE mc.tier
          WHEN 'fast' THEN 1
          WHEN 'standard' THEN 2
          WHEN 'premium' THEN 3
        END
    `).all();

    res.json(models);
  } catch (error) {
    console.error('List models error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/models/:tier - Update or create model config for a tier
router.put('/:tier', (req, res) => {
  try {
    const { tier } = req.params;
    const { provider_id, model_id, max_tokens = 2048, temperature = 0.5, is_active = true } = req.body;

    if (!['fast', 'standard', 'premium'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be "fast", "standard", or "premium"' });
    }

    if (!provider_id || !model_id) {
      return res.status(400).json({ error: 'provider_id and model_id are required' });
    }

    // Verify provider exists
    const provider = db.prepare('SELECT id FROM llm_providers WHERE id = ?').get(provider_id);
    if (!provider) {
      return res.status(400).json({ error: 'Provider not found' });
    }

    // Check if config exists for this tier
    const existing = db.prepare('SELECT id FROM model_config WHERE tier = ?').get(tier) as any;

    if (existing) {
      // Update existing config
      db.prepare(`
        UPDATE model_config
        SET provider_id = ?, model_id = ?, max_tokens = ?, temperature = ?, is_active = ?, updated_at = ?
        WHERE tier = ?
      `).run(provider_id, model_id, max_tokens, temperature, is_active ? 1 : 0, new Date().toISOString(), tier);

      // Log audit entry
      const auditId = uuidv4();
      db.prepare(`
        INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
        VALUES (?, ?, ?, 'update', 'model_config', ?, ?)
      `).run(auditId, req.user?.id, req.user?.email, existing.id, JSON.stringify({ tier, ...req.body }));

      const updated = db.prepare(`
        SELECT
          mc.*,
          lp.provider,
          lp.display_name as provider_display_name
        FROM model_config mc
        LEFT JOIN llm_providers lp ON mc.provider_id = lp.id
        WHERE mc.tier = ?
      `).get(tier);

      res.json(updated);
    } else {
      // Create new config
      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO model_config (id, tier, provider_id, model_id, max_tokens, temperature, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, tier, provider_id, model_id, max_tokens, temperature, is_active ? 1 : 0, now, now);

      // Log audit entry
      const auditId = uuidv4();
      db.prepare(`
        INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
        VALUES (?, ?, ?, 'create', 'model_config', ?, ?)
      `).run(auditId, req.user?.id, req.user?.email, id, JSON.stringify({ tier, ...req.body }));

      const created = db.prepare(`
        SELECT
          mc.*,
          lp.provider,
          lp.display_name as provider_display_name
        FROM model_config mc
        LEFT JOIN llm_providers lp ON mc.provider_id = lp.id
        WHERE mc.id = ?
      `).get(id);

      res.status(201).json(created);
    }
  } catch (error) {
    console.error('Update model config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/models/routing-rules - Get current routing rules
router.get('/routing-rules', (req, res) => {
  try {
    const rules = db.prepare(`
      SELECT
        mc.tier,
        mc.model_id,
        mc.max_tokens,
        mc.temperature,
        mc.is_active,
        lp.provider,
        lp.display_name as provider_display_name,
        lp.api_key,
        lp.base_url
      FROM model_config mc
      INNER JOIN llm_providers lp ON mc.provider_id = lp.id
      WHERE mc.is_active = 1 AND lp.is_active = 1
      ORDER BY
        CASE mc.tier
          WHEN 'fast' THEN 1
          WHEN 'standard' THEN 2
          WHEN 'premium' THEN 3
        END
    `).all() as any[];

    // Group by tier for easy access
    const routingRules = {
      fast: rules.find(r => r.tier === 'fast') || null,
      standard: rules.find(r => r.tier === 'standard') || null,
      premium: rules.find(r => r.tier === 'premium') || null
    };

    res.json(routingRules);
  } catch (error) {
    console.error('Get routing rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
