import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

interface FunctionDef {
  name: string;
  description: string;
  category: string;
  scope: string;
}

interface FunctionConfig {
  name: string;
  enabled: boolean;
  requiresApproval: boolean;
  tierOverride?: 'fast' | 'standard' | 'premium';
}

export default function FunctionsPage() {
  const [functions, setFunctions] = useState<FunctionDef[]>([]);
  const [configs, setConfigs] = useState<Record<string, FunctionConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadFunctions();
  }, []);

  const loadFunctions = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch function definitions from ai-runtime
      const functionsRes = await fetch('http://localhost:4001/functions').then(r => r.json()).catch(() => ({ functions: [] }));

      // Fetch configs from api-server
      const configsRes = await apiFetch('/api/admin/functions').catch(() => ({ configs: {} }));

      setFunctions(functionsRes.functions || []);
      setConfigs(configsRes.configs || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load functions');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (functionName: string, field: 'enabled' | 'requiresApproval', value: boolean) => {
    setSaving(functionName);
    setError('');

    const updatedConfig = {
      ...configs[functionName],
      [field]: value,
    };

    setConfigs({
      ...configs,
      [functionName]: updatedConfig,
    });

    try {
      await apiFetch(`/api/admin/functions/${functionName}`, {
        method: 'PUT',
        body: JSON.stringify(updatedConfig),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update function');
      // Revert on error
      loadFunctions();
    } finally {
      setSaving(null);
    }
  };

  const handleTierChange = async (functionName: string, tier: string) => {
    setSaving(functionName);
    setError('');

    const updatedConfig = {
      ...configs[functionName],
      tierOverride: tier === 'default' ? undefined : tier as 'fast' | 'standard' | 'premium',
    };

    setConfigs({
      ...configs,
      [functionName]: updatedConfig,
    });

    try {
      await apiFetch(`/api/admin/functions/${functionName}`, {
        method: 'PUT',
        body: JSON.stringify(updatedConfig),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update function');
      loadFunctions();
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div style={{ color: '#6b7280' }}>Loading functions...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          Function Management
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Configure function availability, approval requirements, and routing
        </p>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#991b1b',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: 'white',
        border: '1px solid #e2e5e9',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e2e5e9' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '200px' }}>
                  Function
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Description
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '100px' }}>
                  Category
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '80px' }}>
                  Enabled
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '100px' }}>
                  Approval
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '140px' }}>
                  Tier Override
                </th>
              </tr>
            </thead>
            <tbody>
              {functions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                    No functions found
                  </td>
                </tr>
              ) : (
                functions.map((func) => {
                  const config = configs[func.name] || { enabled: true, requiresApproval: false };
                  const isSaving = saving === func.name;

                  return (
                    <tr key={func.name} style={{ borderBottom: '1px solid #e2e5e9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827', marginBottom: '2px' }}>
                          {func.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {func.scope}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>
                        {func.description}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: '#f3f4f6',
                          color: '#6b7280',
                        }}>
                          {func.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => handleToggle(func.name, 'enabled', e.target.checked)}
                            disabled={isSaving}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: isSaving ? 'not-allowed' : 'pointer',
                            }}
                          />
                        </label>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={config.requiresApproval}
                            onChange={(e) => handleToggle(func.name, 'requiresApproval', e.target.checked)}
                            disabled={isSaving}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: isSaving ? 'not-allowed' : 'pointer',
                            }}
                          />
                        </label>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <select
                          value={config.tierOverride || 'default'}
                          onChange={(e) => handleTierChange(func.name, e.target.value)}
                          disabled={isSaving}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #e2e5e9',
                            borderRadius: '4px',
                            fontSize: '13px',
                            background: 'white',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <option value="default">Default</option>
                          <option value="fast">Fast</option>
                          <option value="standard">Standard</option>
                          <option value="premium">Premium</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
          Configuration Guide
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1e40af', lineHeight: '1.6' }}>
          <li><strong>Enabled:</strong> Control whether this function can be called</li>
          <li><strong>Approval:</strong> Require manual approval before execution</li>
          <li><strong>Tier Override:</strong> Route to specific model tier (overrides default routing)</li>
        </ul>
      </div>
    </div>
  );
}
