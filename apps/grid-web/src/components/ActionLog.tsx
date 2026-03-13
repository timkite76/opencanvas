import React, { useState, useEffect, useCallback } from 'react';

const AI_RUNTIME_URL = 'http://localhost:4001';

interface ActionEntry {
  actionId: string;
  agentName: string;
  taskType: string;
  inputSummary: string;
  functionCalls: Array<{
    functionCallId: string;
    functionName: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>;
  changedObjectIds: string[];
  operationIds: string[];
  approvalState: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  timestamp: string;
}

interface ActionLogStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  byFunction: Record<string, number>;
}

interface ActionLogProps {
  isOpen: boolean;
  onClose: () => void;
}

const panelFont: React.CSSProperties = {
  fontFamily: "'Inter', system-ui, sans-serif",
};

const statusColors: Record<string, string> = {
  approved: '#059669',
  rejected: '#dc2626',
  pending: '#d97706',
  auto_approved: '#059669',
};

const statusBgColors: Record<string, string> = {
  approved: '#ecfdf5',
  rejected: '#fef2f2',
  pending: '#fffbeb',
  auto_approved: '#ecfdf5',
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export const ActionLog: React.FC<ActionLogProps> = ({ isOpen, onClose }) => {
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [stats, setStats] = useState<ActionLogStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logRes, statsRes] = await Promise.all([
        fetch(`${AI_RUNTIME_URL}/ai/action-log`),
        fetch(`${AI_RUNTIME_URL}/ai/action-log/stats`),
      ]);
      if (!logRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch action log');
      }
      const logData = await logRes.json() as { actions: ActionEntry[] };
      const statsData = await statsRes.json() as ActionLogStats;
      setActions(logData.actions);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  if (!isOpen) return null;

  // Find most used function
  let mostUsedFn = 'N/A';
  if (stats && Object.keys(stats.byFunction).length > 0) {
    let maxCount = 0;
    for (const [fn, count] of Object.entries(stats.byFunction)) {
      if (count > maxCount) {
        maxCount = count;
        mostUsedFn = fn;
      }
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.08)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        ...panelFont,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
          AI Action Log
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={fetchData}
            style={{
              padding: '4px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: '#fff',
              fontSize: 12,
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              fontSize: 18,
              cursor: 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            x
          </button>
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            gap: 12,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <div style={{
            padding: '8px 12px',
            background: '#f9fafb',
            borderRadius: 6,
            flex: 1,
            minWidth: 80,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>{stats.total}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Total</div>
          </div>
          <div style={{
            padding: '8px 12px',
            background: '#ecfdf5',
            borderRadius: 6,
            flex: 1,
            minWidth: 80,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#059669' }}>{stats.approved}</div>
            <div style={{ fontSize: 11, color: '#059669' }}>Approved</div>
          </div>
          <div style={{
            padding: '8px 12px',
            background: '#fef2f2',
            borderRadius: 6,
            flex: 1,
            minWidth: 80,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#dc2626' }}>{stats.rejected}</div>
            <div style={{ fontSize: 11, color: '#dc2626' }}>Rejected</div>
          </div>
          <div style={{
            padding: '8px 12px',
            background: '#fffbeb',
            borderRadius: 6,
            flex: 1,
            minWidth: 80,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#d97706' }}>{stats.pending}</div>
            <div style={{ fontSize: 11, color: '#d97706' }}>Pending</div>
          </div>
        </div>
      )}

      {/* Most used function */}
      {stats && stats.total > 0 && (
        <div style={{
          padding: '8px 20px',
          borderBottom: '1px solid #f3f4f6',
          fontSize: 12,
          color: '#6b7280',
          flexShrink: 0,
        }}>
          Most used: <span style={{ fontWeight: 500, color: '#374151' }}>{mostUsedFn}</span>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>
            Loading action log...
          </div>
        )}

        {error && (
          <div style={{
            padding: 16,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#dc2626',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && actions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>
            No AI actions recorded yet. Use AI functions to see actions here.
          </div>
        )}

        {/* Timeline */}
        {[...actions].reverse().map((action) => (
          <div
            key={action.actionId}
            style={{
              marginBottom: 12,
              padding: '12px 14px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: statusColors[action.approvalState] ?? '#9ca3af',
            }}
          >
            {/* Top row: timestamp + status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                {formatTimestamp(action.timestamp)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: statusBgColors[action.approvalState] ?? '#f3f4f6',
                  color: statusColors[action.approvalState] ?? '#6b7280',
                  textTransform: 'capitalize',
                }}
              >
                {action.approvalState.replace('_', ' ')}
              </span>
            </div>

            {/* Function name */}
            {action.functionCalls.map((fc) => (
              <div key={fc.functionCallId} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                  {fc.functionName}
                </div>
              </div>
            ))}

            {/* Input summary */}
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {truncate(action.inputSummary, 80)}
            </div>

            {/* Changed objects */}
            {action.changedObjectIds.length > 0 && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Changed: {action.changedObjectIds.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
