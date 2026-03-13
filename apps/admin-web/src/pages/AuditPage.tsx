import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: string;
  ipAddress?: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async (offset = 0) => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch(`/api/admin/audit?offset=${offset}&limit=50`);

      if (offset === 0) {
        setEntries(response.entries || []);
      } else {
        setEntries([...entries, ...(response.entries || [])]);
      }

      setHasMore(response.hasMore || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    loadAuditLog(entries.length);
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) {
      return { bg: '#d1fae5', text: '#065f46' };
    }
    if (action.includes('update') || action.includes('edit')) {
      return { bg: '#dbeafe', text: '#1e40af' };
    }
    if (action.includes('delete') || action.includes('remove')) {
      return { bg: '#fee2e2', text: '#991b1b' };
    }
    return { bg: '#f3f4f6', text: '#6b7280' };
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType.toLowerCase()) {
      case 'user': return '👤';
      case 'provider': return '🤖';
      case 'model': return '⚡';
      case 'function': return '🔧';
      case 'setting': return '⚙️';
      default: return '📄';
    }
  };

  if (loading && entries.length === 0) {
    return <div style={{ color: '#6b7280' }}>Loading audit log...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          Audit Log
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Track all administrative actions and system changes
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
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '180px' }}>
                  Timestamp
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '150px' }}>
                  Actor
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '140px' }}>
                  Action
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '120px' }}>
                  Resource
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Details
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '140px' }}>
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                    No audit entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const actionColors = getActionColor(entry.action);
                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #e2e5e9' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827', fontWeight: 500 }}>
                        {entry.actor}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: actionColors.bg,
                          color: actionColors.text,
                        }}>
                          {entry.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{getResourceIcon(entry.resourceType)}</span>
                          <span style={{ fontSize: '14px', color: '#374151' }}>
                            {entry.resourceType}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '14px', color: '#111827', marginBottom: '2px' }}>
                          ID: <code style={{
                            padding: '2px 6px',
                            background: '#f9fafb',
                            borderRadius: '3px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}>
                            {entry.resourceId}
                          </code>
                        </div>
                        {entry.details && (
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>
                            {entry.details}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {entry.ipAddress || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            onClick={loadMore}
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: '1px solid #e2e5e9',
              borderRadius: '6px',
              background: loading ? '#f9fafb' : 'white',
              color: loading ? '#9ca3af' : '#374151',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
          Audit Log Information
        </h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: '1.6' }}>
          All administrative actions are logged for security and compliance. Entries include user actions, system changes, and configuration updates. Logs are retained for 90 days.
        </p>
      </div>
    </div>
  );
}
