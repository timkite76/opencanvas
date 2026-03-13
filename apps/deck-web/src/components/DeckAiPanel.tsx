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
        gap: 16,
        background: '#fafafa',
        overflow: 'auto',
      }}
    >
      <strong style={{ fontSize: 14 }}>AI Assistant</strong>

      {/* Section 1: Create Deck from Outline */}
      <div style={{ borderBottom: '1px solid #eee', paddingBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
          Create Deck from Outline
        </div>
        <input
          type="text"
          placeholder="Presentation title"
          value={deckTitle}
          onChange={(e) => setDeckTitle(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            marginBottom: 6,
            boxSizing: 'border-box',
          }}
        />
        <input
          type="text"
          placeholder="Slide titles (comma-separated)"
          value={slideTitlesInput}
          onChange={(e) => setSlideTitlesInput(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            marginBottom: 6,
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleCreateDeck}
          disabled={isLoading || !deckTitle.trim() || !slideTitlesInput.trim()}
          style={{
            width: '100%',
            padding: '6px 12px',
            background: '#1a73e8',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {isLoading ? 'Generating...' : 'Generate Deck'}
        </button>
      </div>

      {/* Section 2: Rewrite Slide */}
      <div style={{ borderBottom: '1px solid #eee', paddingBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
          Rewrite Slide
        </div>
        {selectedSlideId ? (
          <>
            <select
              value={rewriteTone}
              onChange={(e) => setRewriteTone(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                fontSize: 12,
                marginBottom: 6,
                boxSizing: 'border-box',
              }}
            >
              <option value="executive">Executive</option>
              <option value="concise">Concise</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
            </select>
            <button
              onClick={handleRewriteSlide}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '6px 12px',
                background: '#1a73e8',
                color: '#fff',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {isLoading ? 'Rewriting...' : 'Rewrite Slide Text'}
            </button>
          </>
        ) : (
          <div style={{ color: '#888', fontSize: 11 }}>Select a slide first</div>
        )}
      </div>

      {/* Section 3: Generate Speaker Notes */}
      <div style={{ borderBottom: '1px solid #eee', paddingBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
          Generate Speaker Notes
        </div>
        {selectedSlideId ? (
          <button
            onClick={handleGenerateNotes}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '6px 12px',
              background: '#1a73e8',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {isLoading ? 'Generating...' : 'Generate Notes'}
          </button>
        ) : (
          <div style={{ color: '#888', fontSize: 11 }}>Select a slide first</div>
        )}
      </div>

      {/* Preview panel */}
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
          {pendingTaskId && (
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
          )}
        </div>
      )}
    </div>
  );
};
