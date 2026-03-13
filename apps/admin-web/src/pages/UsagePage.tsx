import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  estimatedCost: number;
  avgResponseTime: number;
}

interface UsageEntry {
  id: string;
  timestamp: string;
  functionName: string;
  provider: string;
  model: string;
  tokens: number;
  cost: number;
  status: 'success' | 'error';
  responseTime: number;
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats>({
    totalCalls: 0,
    totalTokens: 0,
    estimatedCost: 0,
    avgResponseTime: 0,
  });
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    setLoading(true);
    setError('');

    try {
      const [statsRes, usageRes] = await Promise.all([
        apiFetch('/api/admin/usage/stats').catch(() => ({})),
        apiFetch('/api/admin/usage').catch(() => ({ usage: [] })),
      ]);

      setStats({
        totalCalls: statsRes.totalCalls || 0,
        totalTokens: statsRes.totalTokens || 0,
        estimatedCost: statsRes.estimatedCost || 0,
        avgResponseTime: statsRes.avgResponseTime || 0,
      });
      setUsage(usageRes.usage || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, unit, icon }: { title: string; value: number; unit?: string; icon: string }) => (
    <div style={{
      padding: '20px',
      background: 'white',
      border: '1px solid #e2e5e9',
      borderRadius: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>{title}</div>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 600, color: '#111827' }}>
        {unit === 'currency' && '$'}
        {value.toLocaleString()}
        {unit === 'ms' && 'ms'}
      </div>
    </div>
  );

  if (loading) {
    return <div style={{ color: '#6b7280' }}>Loading usage data...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          Usage Analytics
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Monitor AI usage, costs, and performance
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
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <StatCard title="Total Calls" value={stats.totalCalls} icon="📊" />
        <StatCard title="Total Tokens" value={stats.totalTokens} icon="⚡" />
        <StatCard title="Estimated Cost" value={stats.estimatedCost} unit="currency" icon="💰" />
        <StatCard title="Avg Response Time" value={Math.round(stats.avgResponseTime)} unit="ms" icon="⏱️" />
      </div>

      <div style={{
        background: 'white',
        border: '1px solid #e2e5e9',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e5e9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>
            Recent Usage
          </h3>
          <button style={{
            padding: '6px 12px',
            border: '1px solid #e2e5e9',
            borderRadius: '6px',
            background: 'white',
            color: '#374151',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Export CSV
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e2e5e9' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Timestamp
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Function
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Provider
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Model
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Tokens
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Cost
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Time (ms)
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                    No usage data available
                  </td>
                </tr>
              ) : (
                usage.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #e2e5e9' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827', fontWeight: 500 }}>
                      {entry.functionName}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>
                      {entry.provider}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <code style={{
                        padding: '2px 6px',
                        background: '#f9fafb',
                        borderRadius: '3px',
                        fontSize: '12px',
                        color: '#111827',
                        fontFamily: 'monospace',
                      }}>
                        {entry.model}
                      </code>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', color: '#111827' }}>
                      {entry.tokens.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', color: '#111827', fontWeight: 500 }}>
                      ${entry.cost.toFixed(4)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', color: '#6b7280' }}>
                      {entry.responseTime}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: entry.status === 'success' ? '#d1fae5' : '#fee2e2',
                        color: entry.status === 'success' ? '#065f46' : '#991b1b',
                      }}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {usage.length > 0 && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button style={{
            padding: '10px 20px',
            border: '1px solid #e2e5e9',
            borderRadius: '6px',
            background: 'white',
            color: '#374151',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
