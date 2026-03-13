import React, { useState, useEffect } from 'react';
import { getToken, setToken } from './api';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import ProvidersPage from './pages/ProvidersPage';
import ModelsPage from './pages/ModelsPage';
import FunctionsPage from './pages/FunctionsPage';
import UsagePage from './pages/UsagePage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'dashboard' | 'users' | 'providers' | 'models' | 'functions' | 'usage' | 'audit' | 'settings';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [activePage, setActivePage] = useState<Page>('dashboard');

  useEffect(() => {
    setIsAuthenticated(!!getToken());
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    setIsAuthenticated(false);
    setActivePage('dashboard');
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb' }}>
      {/* Sidebar */}
      <div style={{
        width: 240,
        background: 'white',
        borderRight: '1px solid #e2e5e9',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e5e9',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '24px' }}>⚙️</span>
          <span style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>Admin</span>
        </div>

        <nav style={{ flex: 1, padding: '16px 0' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'users', label: 'Users', icon: '👥' },
            { id: 'providers', label: 'LLM Providers', icon: '🤖' },
            { id: 'models', label: 'Models', icon: '⚡' },
            { id: 'functions', label: 'Functions', icon: '🔧' },
            { id: 'usage', label: 'Usage', icon: '📈' },
            { id: 'audit', label: 'Audit Log', icon: '📋' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id as Page)}
              style={{
                width: '100%',
                padding: '10px 20px',
                border: 'none',
                background: activePage === item.id ? '#f3f4f6' : 'transparent',
                color: activePage === item.id ? '#111827' : '#6b7280',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activePage === item.id ? 500 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (activePage !== item.id) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (activePage !== item.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          height: 64,
          background: 'white',
          borderBottom: '1px solid #e2e5e9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#111827' }}>
            {activePage.charAt(0).toUpperCase() + activePage.slice(1).replace(/([A-Z])/g, ' $1')}
          </h1>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              border: '1px solid #e2e5e9',
              borderRadius: '6px',
              background: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
            }}
          >
            Logout
          </button>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {activePage === 'dashboard' && <Dashboard />}
          {activePage === 'users' && <UsersPage />}
          {activePage === 'providers' && <ProvidersPage />}
          {activePage === 'models' && <ModelsPage />}
          {activePage === 'functions' && <FunctionsPage />}
          {activePage === 'usage' && <UsagePage />}
          {activePage === 'audit' && <AuditPage />}
          {activePage === 'settings' && <SettingsPage />}
        </div>
      </div>
    </div>
  );
}
