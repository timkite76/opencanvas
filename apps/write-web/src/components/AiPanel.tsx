import React from 'react';
import type { CanonicalSelection } from '@opencanvas/write-editor';
import type { Operation } from '@opencanvas/core-types';

interface AiPanelProps {
  selection: CanonicalSelection | null;
  pendingPreview: {
    taskId: string;
    previewText: string;
    operations: Operation[];
  } | null;
  isLoading: boolean;
  onRewrite: (tone: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

const TONES = ['executive', 'concise', 'friendly', 'formal'];

const panelFont: React.CSSProperties = {
  fontFamily: "'Inter', system-ui, sans-serif",
};

const sectionHeader: React.CSSProperties = {
  ...panelFont,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#6b7280',
  marginBottom: 10,
};

const toneButtonBase: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '9px 14px',
  marginBottom: 6,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#ffffff',
  fontSize: 13,
  fontFamily: "'Inter', system-ui, sans-serif",
  color: '#374151',
  textAlign: 'left' as const,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const toneButtonDisabled: React.CSSProperties = {
  ...toneButtonBase,
  opacity: 0.45,
  cursor: 'not-allowed',
};

/** Loading spinner using pure CSS animation via inline keyframes trick */
const LoadingSpinner: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
    <div
      style={{
        width: 18,
        height: 18,
        border: '2px solid #e5e7eb',
        borderTopColor: '#4a90d9',
        borderRadius: '50%',
        animation: 'ai-spin 0.7s linear infinite',
      }}
    />
    <span style={{ color: '#6b7280', fontSize: 13, ...panelFont }}>Processing...</span>
  </div>
);

export const AiPanel: React.FC<AiPanelProps> = ({
  selection,
  pendingPreview,
  isLoading,
  onRewrite,
  onApprove,
  onReject,
}) => {
  return (
    <div
      style={{
        padding: '20px 18px',
        borderLeft: '1px solid #e5e7eb',
        width: 320,
        ...panelFont,
        fontSize: 14,
        backgroundColor: '#fafbfc',
        overflowY: 'auto',
      }}
    >
      {/* Inject spinner keyframes */}
      <style>{`@keyframes ai-spin { to { transform: rotate(360deg); } }`}</style>

      <h3 style={{
        margin: '0 0 20px',
        fontSize: 15,
        fontWeight: 600,
        color: '#111827',
        ...panelFont,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 6,
          backgroundColor: '#ede9fe',
          fontSize: 13,
        }}>
          {/* Sparkle icon via unicode */}
          &#x2728;
        </span>
        AI Assistant
      </h3>

      {/* Selection info */}
      {selection && (
        <div style={{
          marginBottom: 18,
          padding: '10px 12px',
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        }}>
          <div style={{ ...sectionHeader, marginBottom: 6 }}>Selection</div>
          <div style={{ fontSize: 13, color: '#374151' }}>
            <span style={{ fontWeight: 500 }}>{selection.objectId}</span>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Offset {selection.startOffset} &ndash; {selection.endOffset}
          </div>
        </div>
      )}

      {/* Rewrite section */}
      <div style={{ marginBottom: 18 }}>
        <div style={sectionHeader}>Rewrite Block</div>
        {TONES.map((tone) => {
          const disabled = !selection || isLoading;
          return (
            <button
              key={tone}
              onClick={() => onRewrite(tone)}
              disabled={disabled}
              style={disabled ? toneButtonDisabled : toneButtonBase}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            >
              Rewrite {tone.charAt(0).toUpperCase() + tone.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Loading spinner */}
      {isLoading && <LoadingSpinner />}

      {/* Preview */}
      {pendingPreview && (
        <div
          style={{
            marginTop: 8,
            padding: '14px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={sectionHeader}>Preview</div>
          <div style={{
            whiteSpace: 'pre-wrap',
            marginBottom: 14,
            fontSize: 13,
            lineHeight: 1.7,
            color: '#1f2937',
            maxHeight: 240,
            overflowY: 'auto',
            padding: '10px 12px',
            backgroundColor: '#f9fafb',
            borderRadius: 6,
            border: '1px solid #f3f4f6',
          }}>
            {pendingPreview.previewText}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onApprove}
              style={{
                flex: 1,
                padding: '8px 16px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                ...panelFont,
                transition: 'background-color 0.12s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#047857'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#059669'; }}
            >
              Apply
            </button>
            <button
              onClick={onReject}
              style={{
                flex: 1,
                padding: '8px 16px',
                background: '#ffffff',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                ...panelFont,
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selection && !pendingPreview && !isLoading && (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          Select text in the document to use AI rewriting tools.
        </div>
      )}
    </div>
  );
};
