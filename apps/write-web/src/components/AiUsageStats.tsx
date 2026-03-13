import React, { useState, useEffect, useCallback } from 'react';

const AI_RUNTIME_URL = 'http://localhost:4001';

interface ActionLogStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  byFunction: Record<string, number>;
}

const panelFont: React.CSSProperties = {
  fontFamily: "'Inter', system-ui, sans-serif",
};

export const AiUsageStats: React.FC = () => {
  const [stats, setStats] = useState<ActionLogStats | null>(null);
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${AI_RUNTIME_URL}/ai/action-log/stats`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json() as ActionLogStats;
      setStats(data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (error || !stats) return null;
  if (stats.total === 0) return null;

  // Find most used function
  let mostUsedFn = 'N/A';
  let maxCount = 0;
  for (const [fn, count] of Object.entries(stats.byFunction)) {
    if (count > maxCount) {
      maxCount = count;
      mostUsedFn = fn;
    }
  }

  const approvalRate =
    stats.approved + stats.rejected > 0
      ? Math.round((stats.approved / (stats.approved + stats.rejected)) * 100)
      : 0;

  return (
    <div
      style={{
        padding: '12px 14px',
        margin: '12px 0',
        background: '#f9fafb',
        borderRadius: 8,
        border: '1px solid #f3f4f6',
        ...panelFont,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#6b7280',
          marginBottom: 8,
        }}
      >
        Session Stats
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ fontSize: 12, color: '#374151' }}>
          <span style={{ fontWeight: 600 }}>{stats.total}</span> total actions
        </div>
        <div style={{ fontSize: 12, color: '#374151' }}>
          <span style={{ fontWeight: 600, color: '#059669' }}>{approvalRate}%</span> approval
        </div>
        <div style={{ fontSize: 12, color: '#374151', gridColumn: '1 / -1' }}>
          Top: <span style={{ fontWeight: 500 }}>{mostUsedFn.replace(/_/g, ' ')}</span>
        </div>
      </div>
    </div>
  );
};
