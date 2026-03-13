import React, { useState, useCallback } from 'react';

interface DeckAiPanelProps {
  selectedSlideId: string | null;
  isLoading: boolean;
  previewText: string | null;
  onAiTask: (taskType: string, parameters: Record<string, unknown>) => void;
  onApprove: () => void;
  onReject: () => void;
  pendingTaskId: string | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #dadce0',
  borderRadius: 6,
  fontSize: 12,
  marginBottom: 8,
  boxSizing: 'border-box' as const,
  fontFamily: 'system-ui, sans-serif',
  color: '#3c4043',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  outline: 'none',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 14px',
  background: '#1a73e8',
  color: '#ffffff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'system-ui, sans-serif',
  transition: 'background 0.15s ease',
};

const disabledBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const sectionCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 8,
  border: '1px solid #e8eaed',
  padding: 14,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
  marginBottom: 10,
  color: '#3c4043',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

export const DeckAiPanel: React.FC<DeckAiPanelProps> = ({
  selectedSlideId,
  isLoading,
  previewText,
  onAiTask,
  onApprove,
  onReject,
  pendingTaskId,
}) => {
  const [deckTitle, setDeckTitle] = useState('');
  const [slideTitlesInput, setSlideTitlesInput] = useState('');
  const [rewriteTone, setRewriteTone] = useState('executive');

  const handleCreateDeck = useCallback(() => {
    if (!deckTitle.trim() || !slideTitlesInput.trim()) return;
    const slideTitles = slideTitlesInput.split(',').map((s) => s.trim()).filter(Boolean);
    onAiTask('create_deck_from_outline', { title: deckTitle.trim(), slideTitles });
  }, [deckTitle, slideTitlesInput, onAiTask]);

  const handleRewriteSlide = useCallback(() => {
    if (!selectedSlideId) return;
    onAiTask('rewrite_slide', { slideId: selectedSlideId, tone: rewriteTone });
  }, [selectedSlideId, rewriteTone, onAiTask]);

  const handleGenerateNotes = useCallback(() => {
    if (!selectedSlideId) return;
    onAiTask('generate_speaker_notes', { slideId: selectedSlideId });
  }, [selectedSlideId, onAiTask]);

  const inputFocusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = '#1a73e8';
      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(26, 115, 232, 0.15)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = '#dadce0';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  return (
    <div
      style={{
        width: 280,
        borderLeft: '1px solid #dadce0',
        padding: 16,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#f8f9fa',
        overflow: 'auto',
      }}
    >
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 8,
        borderBottom: '1px solid #e8eaed',
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #8e24aa, #e040fb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
        }}>
          AI
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#202124' }}>AI Assistant</span>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: '#e8f0fe',
          borderRadius: 6,
          fontSize: 12,
          color: '#1a73e8',
          fontWeight: 500,
        }}>
          <div style={{
            width: 14,
            height: 14,
            border: '2px solid #a8c7fa',
            borderTopColor: '#1a73e8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          Processing...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Section 1: Create Deck from Outline */}
      <div style={sectionCardStyle}>
        <div style={sectionTitleStyle}>
          Create Deck from Outline
        </div>
        <input
          type="text"
          placeholder="Presentation title"
          value={deckTitle}
          onChange={(e) => setDeckTitle(e.target.value)}
          style={inputStyle}
          {...inputFocusHandlers}
        />
        <input
          type="text"
          placeholder="Slide titles (comma-separated)"
          value={slideTitlesInput}
          onChange={(e) => setSlideTitlesInput(e.target.value)}
          style={inputStyle}
          {...inputFocusHandlers}
        />
        <button
          onClick={handleCreateDeck}
          disabled={isLoading || !deckTitle.trim() || !slideTitlesInput.trim()}
          style={isLoading || !deckTitle.trim() || !slideTitlesInput.trim() ? disabledBtnStyle : primaryBtnStyle}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#1557b0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#1a73e8'; }}
        >
          {isLoading ? 'Generating...' : 'Generate Deck'}
        </button>
      </div>

      {/* Section 2: Rewrite Slide */}
      <div style={sectionCardStyle}>
        <div style={sectionTitleStyle}>
          Rewrite Slide
        </div>
        {selectedSlideId ? (
          <>
            <select
              value={rewriteTone}
              onChange={(e) => setRewriteTone(e.target.value)}
              style={{
                ...inputStyle,
                appearance: 'none' as const,
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" fill="none" stroke="#5f6368" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')}")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                paddingRight: 28,
                cursor: 'pointer',
              }}
              {...inputFocusHandlers}
            >
              <option value="executive">Executive</option>
              <option value="concise">Concise</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
            </select>
            <button
              onClick={handleRewriteSlide}
              disabled={isLoading}
              style={isLoading ? disabledBtnStyle : primaryBtnStyle}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#1557b0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1a73e8'; }}
            >
              {isLoading ? 'Rewriting...' : 'Rewrite Slide Text'}
            </button>
          </>
        ) : (
          <div style={{
            color: '#80868b',
            fontSize: 12,
            padding: '8px 0',
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            Select a slide first
          </div>
        )}
      </div>

      {/* Section 3: Generate Speaker Notes */}
      <div style={sectionCardStyle}>
        <div style={sectionTitleStyle}>
          Generate Speaker Notes
        </div>
        {selectedSlideId ? (
          <button
            onClick={handleGenerateNotes}
            disabled={isLoading}
            style={isLoading ? disabledBtnStyle : primaryBtnStyle}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#1557b0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#1a73e8'; }}
          >
            {isLoading ? 'Generating...' : 'Generate Notes'}
          </button>
        ) : (
          <div style={{
            color: '#80868b',
            fontSize: 12,
            padding: '8px 0',
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            Select a slide first
          </div>
        )}
      </div>

      {/* Preview panel */}
      {previewText && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e8eaed',
            borderRadius: 8,
            padding: 14,
            fontSize: 12,
            lineHeight: 1.6,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{
            fontWeight: 600,
            marginBottom: 8,
            color: '#3c4043',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#34a853',
            }} />
            AI Response
          </div>
          <pre style={{
            whiteSpace: 'pre-wrap',
            margin: 0,
            fontFamily: 'system-ui, sans-serif',
            color: '#3c4043',
            padding: '8px 10px',
            background: '#f8f9fa',
            borderRadius: 6,
            border: '1px solid #e8eaed',
          }}>
            {previewText}
          </pre>
          {pendingTaskId && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={onApprove}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  background: '#188038',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#137333'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#188038'}
              >
                Apply
              </button>
              <button
                onClick={onReject}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  background: '#ffffff',
                  color: '#5f6368',
                  border: '1px solid #dadce0',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f3f4'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
