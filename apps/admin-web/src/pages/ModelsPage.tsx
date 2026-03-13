import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

interface ModelConfig {
  tier: 'fast' | 'standard' | 'premium';
  providerId: string;
  providerName: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ModelConfig>>({});

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/admin/models');
      setModels(response.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (model: ModelConfig) => {
    setEditingTier(model.tier);
    setEditForm(model);
  };

  const handleSave = async () => {
    if (!editingTier) return;
    setError('');

    try {
      await apiFetch(`/api/admin/models/${editingTier}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });

      setEditingTier(null);
      setEditForm({});
      loadModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'fast': return { bg: '#dbeafe', text: '#1e40af' };
      case 'standard': return { bg: '#e0e7ff', text: '#4338ca' };
      case 'premium': return { bg: '#fce7f3', text: '#9f1239' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  if (loading) {
    return <div style={{ color: '#6b7280' }}>Loading model configurations...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          Model Routing Configuration
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Configure which models are used for each performance tier
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {models.length === 0 ? (
          <div style={{
            padding: '32px',
            background: 'white',
            border: '1px solid #e2e5e9',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px',
            gridColumn: '1 / -1',
          }}>
            No model configurations found
          </div>
        ) : (
          models.map((model) => {
            const colors = getTierColor(model.tier);
            const isEditing = editingTier === model.tier;

            return (
              <div
                key={model.tier}
                style={{
                  padding: '20px',
                  background: 'white',
                  border: '1px solid #e2e5e9',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: colors.bg,
                      color: colors.text,
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                    }}>
                      {model.tier}
                    </span>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                      {model.tier === 'fast' && 'Fast Tier'}
                      {model.tier === 'standard' && 'Standard Tier'}
                      {model.tier === 'premium' && 'Premium Tier'}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                      {model.tier === 'fast' && 'Low latency, simple tasks'}
                      {model.tier === 'standard' && 'Balanced performance'}
                      {model.tier === 'premium' && 'Maximum capabilities'}
                    </p>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => handleEdit(model)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #e2e5e9',
                        borderRadius: '6px',
                        background: 'white',
                        color: '#374151',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                        Model ID
                      </label>
                      <input
                        type="text"
                        value={editForm.modelId || ''}
                        onChange={(e) => setEditForm({ ...editForm, modelId: e.target.value })}
                        placeholder="claude-3-5-sonnet-20241022"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #e2e5e9',
                          borderRadius: '6px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={editForm.maxTokens || 0}
                        onChange={(e) => setEditForm({ ...editForm, maxTokens: parseInt(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #e2e5e9',
                          borderRadius: '6px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                        Temperature
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={editForm.temperature || 0}
                        onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #e2e5e9',
                          borderRadius: '6px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleSave}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: 'none',
                          borderRadius: '6px',
                          background: '#111827',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingTier(null);
                          setEditForm({});
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #e2e5e9',
                          borderRadius: '6px',
                          background: 'white',
                          color: '#374151',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Provider</div>
                      <div style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>{model.providerName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Model</div>
                      <code style={{
                        display: 'block',
                        padding: '6px 8px',
                        background: '#f9fafb',
                        border: '1px solid #e2e5e9',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#111827',
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                      }}>
                        {model.modelId}
                      </code>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Max Tokens</div>
                        <div style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>{model.maxTokens.toLocaleString()}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Temperature</div>
                        <div style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>{model.temperature}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{
        marginTop: '32px',
        padding: '16px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
          Tier Usage
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1e40af', lineHeight: '1.6' }}>
          <li><strong>Fast:</strong> Simple operations, code formatting, basic queries</li>
          <li><strong>Standard:</strong> Most functions, balanced cost and performance</li>
          <li><strong>Premium:</strong> Complex analysis, creative tasks, critical decisions</li>
        </ul>
      </div>
    </div>
  );
}
