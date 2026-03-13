import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const router = Router();

// Helper to mask API key (show only last 4 characters)
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 4) return '****';
  return '*'.repeat(apiKey.length - 4) + apiKey.slice(-4);
}

// GET /api/admin/providers - List all providers (with masked API keys)
router.get('/', (req, res) => {
  try {
    const providers = db.prepare('SELECT * FROM llm_providers ORDER BY created_at DESC').all() as any[];

    const maskedProviders = providers.map(p => ({
      ...p,
      api_key: maskApiKey(p.api_key)
    }));

    res.json(maskedProviders);
  } catch (error) {
    console.error('List providers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/providers/active - Get active providers with full API keys (for internal use)
router.get('/active', (req, res) => {
  try {
    const providers = db.prepare('SELECT * FROM llm_providers WHERE is_active = 1').all();
    res.json(providers);
  } catch (error) {
    console.error('Get active providers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/providers - Create provider
router.post('/', (req, res) => {
  try {
    const { provider, display_name, api_key, base_url, is_default = false } = req.body;

    if (!provider || !display_name || !api_key) {
      return res.status(400).json({ error: 'Provider, display_name, and api_key are required' });
    }

    if (!['anthropic', 'openai'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Must be "anthropic" or "openai"' });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      db.prepare('UPDATE llm_providers SET is_default = 0').run();
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO llm_providers (id, provider, display_name, api_key, base_url, is_default, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, provider, display_name, api_key, base_url || null, is_default ? 1 : 0, now, now);

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, 'create', 'llm_provider', ?, ?)
    `).run(auditId, req.user?.id, req.user?.email, id, JSON.stringify({ provider, display_name }));

    const newProvider = db.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id) as any;
    res.status(201).json({
      ...newProvider,
      api_key: maskApiKey(newProvider.api_key)
    });
  } catch (error) {
    console.error('Create provider error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/providers/:id - Update provider
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, api_key, base_url, is_default, is_active } = req.body;

    // Check if provider exists
    const provider = db.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      db.prepare('UPDATE llm_providers SET is_default = 0').run();
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(display_name);
    }
    if (api_key !== undefined) {
      updates.push('api_key = ?');
      values.push(api_key);
    }
    if (base_url !== undefined) {
      updates.push('base_url = ?');
      values.push(base_url);
    }
    if (is_default !== undefined) {
      updates.push('is_default = ?');
      values.push(is_default ? 1 : 0);
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

    const query = `UPDATE llm_providers SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, 'update', 'llm_provider', ?, ?)
    `).run(auditId, req.user?.id, req.user?.email, id, JSON.stringify(req.body));

    const updatedProvider = db.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id) as any;
    res.json({
      ...updatedProvider,
      api_key: maskApiKey(updatedProvider.api_key)
    });
  } catch (error) {
    console.error('Update provider error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/providers/:id - Delete provider
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Check if provider exists
    const provider = db.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Delete provider
    db.prepare('DELETE FROM llm_providers WHERE id = ?').run(id);

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id)
      VALUES (?, ?, ?, 'delete', 'llm_provider', ?)
    `).run(auditId, req.user?.id, req.user?.email, id);

    res.json({ message: 'Provider deleted successfully' });
  } catch (error) {
    console.error('Delete provider error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/providers/:id/test - Test provider connectivity
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    // Get provider details
    const provider = db.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id) as any;
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    let success = false;
    let errorMessage = '';

    try {
      if (provider.provider === 'anthropic') {
        const client = new Anthropic({
          apiKey: provider.api_key,
          baseURL: provider.base_url || undefined
        });

        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        });

        success = response.content.length > 0;
      } else if (provider.provider === 'openai') {
        const client = new OpenAI({
          apiKey: provider.api_key,
          baseURL: provider.base_url || undefined
        });

        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        });

        success = response.choices.length > 0;
      } else {
        return res.status(400).json({ error: 'Unsupported provider type' });
      }
    } catch (error: any) {
      success = false;
      errorMessage = error.message || 'Unknown error';
    }

    // Log audit entry
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, actor_email, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, 'test', 'llm_provider', ?, ?)
    `).run(auditId, req.user?.id, req.user?.email, id, JSON.stringify({ success, errorMessage }));

    res.json({
      success,
      message: success ? 'Provider connection successful' : 'Provider connection failed',
      error: errorMessage || undefined
    });
  } catch (error) {
    console.error('Test provider error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
