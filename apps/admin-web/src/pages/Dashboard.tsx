import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

interface Stats {
  providers: number;
  users: number;
  functions: number;
  totalCalls: number;
  totalTokens: number;
  estimatedCost: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    providers: 0,
    users: 0,
    functions: 0,
    totalCalls: 0,
    totalTokens: 0,
    estimatedCost: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');

    try {
      const [providersRes, usersRes, usageRes] = await Promise.all([
        apiFetch('/api/admin/providers').catch(() => ({ providers: [] })),
        apiFetch('/api/admin/users').catch(() => ({ users: [] })),
        apiFetch('/api/admin/usage/stats').catch(() => ({})),
      ]);

      setStats({
        providers: providersRes.providers?.length || 0,
        users: usersRes.users?.length || 0,
        functions: 19, // Fixed count as we know there are 19 functions
        totalCalls: usageRes.totalCalls || 0,
        totalTokens: usageRes.totalTokens || 0,
        estimatedCost: usageRes.estimatedCost || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) => (
    <div style={{
      background: 'white',
      border: '1px solid #e2e5e9',
      borderRadius: '8px',
      padding: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '8px',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '28px', fontWeight: 600, color: '#111827' }}>{value}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#991b1b',
      }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          System Overview
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Monitor your OpenCanvas instance at a glance
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
      }}>
        <StatCard
          title="LLM Providers"
          value={stats.providers}
          icon="🤖"
          color="#dbeafe"
        />
        <StatCard
          title="Users"
          value={stats.users}
          icon="👥"
          color="#e0e7ff"
        />
        <StatCard
          title="Functions"
          value={stats.functions}
          icon="🔧"
          color="#ddd6fe"
        />
        <StatCard
          title="Total AI Calls"
          value={stats.totalCalls.toLocaleString()}
          icon="📊"
          color="#fce7f3"
        />
        <StatCard
          title="Total Tokens"
          value={stats.totalTokens.toLocaleString()}
          icon="⚡"
          color="#fed7aa"
        />
        <StatCard
          title="Estimated Cost"
          value={`$${stats.estimatedCost.toFixed(2)}`}
          icon="💰"
          color="#d1fae5"
        />
      </div>

      <div style={{
        marginTop: '32px',
        padding: '20px',
        background: 'white',
        border: '1px solid #e2e5e9',
        borderRadius: '8px',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button style={{
            padding: '10px 16px',
            border: '1px solid #e2e5e9',
            borderRadius: '6px',
            background: 'white',
            color: '#374151',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            View Recent Activity
          </button>
          <button style={{
            padding: '10px 16px',
            border: '1px solid #e2e5e9',
            borderRadius: '6px',
            background: 'white',
            color: '#374151',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Export Usage Report
          </button>
          <button style={{
            padding: '10px 16px',
            border: '1px solid #e2e5e9',
            borderRadius: '6px',
            background: 'white',
            color: '#374151',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            System Health Check
          </button>
        </div>
      </div>
    </div>
  );
}
