import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

interface Setting {
  key: string;
  value: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'textarea';
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/admin/settings');
      setSettings(response.settings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    setSaving(key);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });

      setSettings(settings.map(s => s.key === key ? { ...s, value } : s));
      setSuccess(`Setting "${key}" updated successfully`);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setSaving(null);
    }
  };

  const SettingField = ({ setting }: { setting: Setting }) => {
    const [localValue, setLocalValue] = useState(setting.value);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
      setLocalValue(setting.value);
      setIsDirty(false);
    }, [setting.value]);

    const handleChange = (value: string) => {
      setLocalValue(value);
      setIsDirty(value !== setting.value);
    };

    const handleSave = () => {
      handleUpdateSetting(setting.key, localValue);
      setIsDirty(false);
    };

    const handleReset = () => {
      setLocalValue(setting.value);
      setIsDirty(false);
    };

    const isSaving = saving === setting.key;

    return (
      <div style={{
        padding: '20px',
        background: 'white',
        border: '1px solid #e2e5e9',
        borderRadius: '8px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '4px',
          }}>
            {setting.key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </label>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
            {setting.description}
          </p>
        </div>

        {setting.type === 'textarea' ? (
          <textarea
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isSaving}
            rows={6}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e2e5e9',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        ) : setting.type === 'number' ? (
          <input
            type="number"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isSaving}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e2e5e9',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        ) : setting.type === 'boolean' ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={localValue === 'true'}
              onChange={(e) => handleChange(e.target.checked ? 'true' : 'false')}
              disabled={isSaving}
              style={{
                width: '20px',
                height: '20px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            />
            <span style={{ fontSize: '14px', color: '#374151' }}>
              {localValue === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        ) : (
          <input
            type="text"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isSaving}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e2e5e9',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        )}

        {isDirty && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: isSaving ? '#9ca3af' : '#111827',
                color: 'white',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleReset}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                border: '1px solid #e2e5e9',
                borderRadius: '6px',
                background: 'white',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div style={{ color: '#6b7280' }}>Loading settings...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          System Settings
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Configure global system behavior and policies
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

      {success && (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          background: '#d1fae5',
          border: '1px solid #a7f3d0',
          borderRadius: '6px',
          color: '#065f46',
          fontSize: '14px',
        }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {settings.length === 0 ? (
          <div style={{
            padding: '32px',
            background: 'white',
            border: '1px solid #e2e5e9',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px',
          }}>
            No settings configured
          </div>
        ) : (
          settings.map((setting) => (
            <SettingField key={setting.key} setting={setting} />
          ))
        )}
      </div>

      <div style={{
        marginTop: '32px',
        padding: '16px',
        background: '#fef3c7',
        border: '1px solid #fde68a',
        borderRadius: '8px',
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#92400e' }}>
          ⚠️ Important
        </h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: '1.6' }}>
          Changes to system settings take effect immediately and apply to all users. Some settings may require service restart. Always test changes in a non-production environment first.
        </p>
      </div>

      <div style={{
        marginTop: '16px',
        padding: '16px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
          Common Settings
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1e40af', lineHeight: '1.6' }}>
          <li><strong>Organization Name:</strong> Display name for your OpenCanvas instance</li>
          <li><strong>Rate Limit:</strong> Maximum API calls per minute per user</li>
          <li><strong>Max Tokens:</strong> Maximum tokens allowed per request</li>
          <li><strong>Content Policy:</strong> Guidelines for acceptable use and content filtering</li>
        </ul>
      </div>
    </div>
  );
}
