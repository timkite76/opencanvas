import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

interface Provider {
  id: string;
  type: 'anthropic' | 'openai';
  displayName: string;
  apiKey: string;
  baseUrl?: string;
  isDefault: boolean;
  createdAt: string;
}

interface TestResult {
  providerId: string;
  success: boolean;
  responseTime?: number;
  error?: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [formData, setFormData] = useState({
    type: 'anthropic' as Provider['type'],
    displayName: '',
    apiKey: '',
    baseUrl: '',
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/admin/providers');
      setProviders(response.providers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await apiFetch('/api/admin/providers', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setFormData({ type: 'anthropic', displayName: '', apiKey: '', baseUrl: '' });
      setShowAddForm(false);
      loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add provider');
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestResults({ ...testResults, [providerId]: { providerId, success: false } });

    try {
      const startTime = Date.now();
      const response = await apiFetch(`/api/admin/providers/${providerId}/test`, {
        method: 'POST',
      });
      const responseTime = Date.now() - startTime;

      setTestResults({
        ...testResults,
        [providerId]: {
          providerId,
          success: response.success,
          responseTime,
          error: response.error,
        },
      });
    } catch (err) {
      setTestResults({
        ...testResults,
        [providerId]: {
          providerId,
          success: false,
          error: err instanceof Error ? err.message : 'Test failed',
        },
      });
    }
  };

  const handleSetDefault = async (providerId: string) => {
    setError('');

    try {
      await apiFetch(`/api/admin/providers/${providerId}/default`, {
        method: 'PUT',
      });
      loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default provider');
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;

    setError('');

    try {
      await apiFetch(`/api/admin/providers/${providerId}`, { method: 'DELETE' });
      loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return '••••' + key.slice(-4);
  };

  if (loading) {
    return <div style={{ color: '#6b7280' }}>Loading providers...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
            LLM Provider Management
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Configure and manage AI model providers
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderRadius: '6px',
            background: '#111827',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Provider'}
        </button>
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

      {showAddForm && (
        <div style={{
          marginBottom: '24px',
          padding: '20px',
          background: 'white',
          border: '1px solid #e2e5e9',
          borderRadius: '8px',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
            Add New Provider
          </h3>
          <form onSubmit={handleAddProvider}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  Provider Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Provider['type'] })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e2e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                  placeholder="e.g., Primary Anthropic"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e2e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  API Key *
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  required
                  placeholder="sk-ant-... or sk-..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e2e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  Base URL (Optional)
                </label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.anthropic.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e2e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>
            <button
              type="submit"
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '6px',
                background: '#111827',
                color: 'white',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Add Provider
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px' }}>
        {providers.length === 0 ? (
          <div style={{
            padding: '32px',
            background: 'white',
            border: '1px solid #e2e5e9',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px',
          }}>
            No providers configured
          </div>
        ) : (
          providers.map((provider) => {
            const testResult = testResults[provider.id];
            return (
              <div
                key={provider.id}
                style={{
                  padding: '20px',
                  background: 'white',
                  border: '1px solid #e2e5e9',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                        {provider.displayName}
                      </h3>
                      {provider.isDefault && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: '#d1fae5',
                          color: '#065f46',
                        }}>
                          DEFAULT
                        </span>
                      )}
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: provider.type === 'anthropic' ? '#dbeafe' : '#e0e7ff',
                        color: provider.type === 'anthropic' ? '#1e40af' : '#4338ca',
                      }}>
                        {provider.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                      API Key: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '3px', fontSize: '13px' }}>
                        {maskApiKey(provider.apiKey)}
                      </code>
                    </div>
                    {provider.baseUrl && (
                      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                        Base URL: {provider.baseUrl}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                      Added {new Date(provider.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleTestProvider(provider.id)}
                      style={{
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
                      Test Connection
                    </button>
                    {!provider.isDefault && (
                      <button
                        onClick={() => handleSetDefault(provider.id)}
                        style={{
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
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteProvider(provider.id)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        background: '#fef2f2',
                        color: '#991b1b',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: testResult.success ? '#d1fae5' : '#fef2f2',
                    border: `1px solid ${testResult.success ? '#a7f3d0' : '#fecaca'}`,
                    fontSize: '14px',
                    color: testResult.success ? '#065f46' : '#991b1b',
                  }}>
                    {testResult.success ? (
                      <>
                        Connection successful! Response time: {testResult.responseTime}ms
                      </>
                    ) : (
                      <>
                        Connection failed: {testResult.error}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
