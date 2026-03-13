import React, { useState, useCallback } from 'react';

interface GridAiPanelProps {
  selectedCellId: string | null;
  selectedCellAddress: string | null;
  onGenerateFormula: (description: string) => void;
  onExplainFormula: () => void;
  isLoading: boolean;
  previewText: string | null;
  onApprove: () => void;
  onReject: () => void;
}

export const GridAiPanel: React.FC<GridAiPanelProps> = ({
  selectedCellId,
  selectedCellAddress,
  onGenerateFormula,
  onExplainFormula,
  isLoading,
  previewText,
  onApprove,
  onReject,
}) => {
  const [description, setDescription] = useState('');

  const handleGenerate = useCallback(() => {
    if (description.trim()) {
      onGenerateFormula(description.trim());
    }
  }, [description, onGenerateFormula]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  return (
    <div
      style={{
        width: 280,
        borderLeft: '1px solid #ddd',
        padding: 16,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#fafafa',
        overflow: 'auto',
      }}
    >
      <strong style={{ fontSize: 14 }}>AI Assistant</strong>

      {selectedCellId ? (
        <>
          <div style={{ color: '#555' }}>
            Selected: <strong>{selectedCellAddress}</strong>
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: 12, display: 'block', marginBottom: 4 }}>
              Describe the formula you need:
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              style={{
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: 3,
                padding: 8,
                fontSize: 13,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              placeholder='e.g. "sum of A1 to A10"'
            />
            <button
              onClick={handleGenerate}
              disabled={isLoading || !description.trim()}
              style={{
                marginTop: 4,
                padding: '6px 12px',
                background: '#1a73e8',
                color: '#fff',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 12,
                width: '100%',
              }}
            >
              {isLoading ? 'Generating...' : 'Generate Formula'}
            </button>
          </div>

          <button
            onClick={onExplainFormula}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Explain Selected Cell Formula
          </button>

          {previewText && (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: 4,
                padding: 12,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>AI Response:</div>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'system-ui, sans-serif' }}>
                {previewText}
              </pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={onApprove}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    background: '#34a853',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Apply
                </button>
                <button
                  onClick={onReject}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    background: '#ea4335',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ color: '#888' }}>Select a cell to use AI features</div>
      )}
    </div>
  );
};
