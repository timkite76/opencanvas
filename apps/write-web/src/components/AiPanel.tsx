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
        padding: 16,
        borderLeft: '1px solid #ddd',
        width: 320,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
      }}
    >
      <h3 style={{ margin: '0 0 12px' }}>AI Assistant</h3>

      {selection && (
        <div style={{ marginBottom: 16, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Selection</div>
          <div>
            <strong>{selection.objectId}</strong>
          </div>
          <div>
            offset {selection.startOffset}–{selection.endOffset}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Rewrite Block</div>
        {TONES.map((tone) => (
          <button
            key={tone}
            onClick={() => onRewrite(tone)}
            disabled={!selection || isLoading}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              marginBottom: 4,
              border: '1px solid #ccc',
              borderRadius: 4,
              background: '#fff',
              cursor: selection && !isLoading ? 'pointer' : 'not-allowed',
              textAlign: 'left',
            }}
          >
            Rewrite {tone.charAt(0).toUpperCase() + tone.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ color: '#888' }}>Processing...</div>}

      {pendingPreview && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#fffde7',
            border: '1px solid #f9e04b',
            borderRadius: 4,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Preview</div>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{pendingPreview.previewText}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onApprove}
              style={{
                padding: '6px 16px',
                background: '#4caf50',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
            <button
              onClick={onReject}
              style={{
                padding: '6px 16px',
                background: '#f44336',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
