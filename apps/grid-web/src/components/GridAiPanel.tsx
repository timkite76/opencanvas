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

const panelFont =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const CARD_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #dadce0',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const AI_BUTTON_PRIMARY: React.CSSProperties = {
  padding: '8px 16px',
  background: '#1a73e8',
  color: '#ffffff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  width: '100%',
  fontFamily: panelFont,
  transition: 'background 0.15s',
};

const AI_BUTTON_SECONDARY: React.CSSProperties = {
  padding: '8px 16px',
  background: '#ffffff',
  color: '#3c4043',
  border: '1px solid #dadce0',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  width: '100%',
  fontFamily: panelFont,
  transition: 'background 0.15s, border-color 0.15s',
};

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
  const [genHovered, setGenHovered] = useState(false);
  const [explainHovered, setExplainHovered] = useState(false);

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
        borderLeft: '1px solid #dadce0',
        padding: 16,
        fontFamily: panelFont,
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#f8f9fa',
        overflow: 'auto',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 8,
          borderBottom: '1px solid #e8eaed',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#e8f0fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: '#1a73e8',
          }}
        >
          {'\u2728'}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#202124' }}>AI Assistant</span>
      </div>

      {selectedCellId ? (
        <>
          {/* Selected cell indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: '#e8f0fe',
              borderRadius: 6,
              fontSize: 12,
              color: '#1a73e8',
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: 11, color: '#5f6368' }}>Cell:</span>
            <span>{selectedCellAddress}</span>
          </div>

          {/* Generate formula card */}
          <div style={CARD_STYLE}>
            <label
              style={{
                fontWeight: 600,
                fontSize: 12,
                color: '#202124',
                display: 'block',
                marginBottom: 8,
              }}
            >
              Generate Formula
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              style={{
                width: '100%',
                border: '1px solid #dadce0',
                borderRadius: 6,
                padding: 10,
                fontSize: 13,
                fontFamily: panelFont,
                resize: 'vertical',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s',
                color: '#202124',
                lineHeight: 1.5,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1a73e8';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#dadce0';
              }}
              placeholder='e.g. "sum of A1 to A10"'
            />
            <button
              onClick={handleGenerate}
              disabled={isLoading || !description.trim()}
              onMouseEnter={() => setGenHovered(true)}
              onMouseLeave={() => setGenHovered(false)}
              style={{
                ...AI_BUTTON_PRIMARY,
                marginTop: 8,
                background:
                  isLoading || !description.trim()
                    ? '#c2d9f2'
                    : genHovered
                      ? '#1557b0'
                      : '#1a73e8',
                cursor: isLoading || !description.trim() ? 'default' : 'pointer',
              }}
            >
              {isLoading ? 'Generating...' : 'Generate Formula'}
            </button>
          </div>

          {/* Explain formula card */}
          <div style={CARD_STYLE}>
            <label
              style={{
                fontWeight: 600,
                fontSize: 12,
                color: '#202124',
                display: 'block',
                marginBottom: 8,
              }}
            >
              Understand Formula
            </label>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#5f6368', lineHeight: 1.4 }}>
              Get an AI explanation of the formula in the selected cell.
            </p>
            <button
              onClick={onExplainFormula}
              disabled={isLoading}
              onMouseEnter={() => setExplainHovered(true)}
              onMouseLeave={() => setExplainHovered(false)}
              style={{
                ...AI_BUTTON_SECONDARY,
                background: isLoading
                  ? '#f8f9fa'
                  : explainHovered
                    ? '#f1f3f4'
                    : '#ffffff',
                borderColor: explainHovered ? '#c0c0c0' : '#dadce0',
                cursor: isLoading ? 'default' : 'pointer',
              }}
            >
              Explain Selected Cell
            </button>
          </div>

          {/* AI Response card */}
          {previewText && (
            <div
              style={{
                ...CARD_STYLE,
                borderColor: '#c2d9f2',
                background: '#f8fbff',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 8,
                  fontSize: 12,
                  color: '#1a73e8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{'\u2728'}</span>
                AI Response
              </div>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  fontFamily: panelFont,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: '#202124',
                  padding: '8px 0',
                  borderTop: '1px solid #e8eaed',
                }}
              >
                {previewText}
              </pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e8eaed' }}>
                <button
                  onClick={onApprove}
                  style={{
                    flex: 1,
                    padding: '8px 8px',
                    background: '#1e8e3e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: panelFont,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#137333';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1e8e3e';
                  }}
                >
                  Apply
                </button>
                <button
                  onClick={onReject}
                  style={{
                    flex: 1,
                    padding: '8px 8px',
                    background: '#ffffff',
                    color: '#5f6368',
                    border: '1px solid #dadce0',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: panelFont,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f3f4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            ...CARD_STYLE,
            textAlign: 'center',
            padding: 24,
            color: '#5f6368',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>{'\u2728'}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            Select a cell to use AI features
          </div>
        </div>
      )}
    </div>
  );
};
