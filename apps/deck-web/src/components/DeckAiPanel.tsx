import React, { useState, useCallback } from 'react';

interface CoachFeedbackItem {
  slideId: string;
  slideIndex: number;
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
}

interface DeckAiPanelProps {
  selectedSlideId: string | null;
  isLoading: boolean;
  previewText: string | null;
  onAiTask: (taskType: string, parameters: Record<string, unknown>) => void;
  onApprove: () => void;
  onReject: () => void;
  pendingTaskId: string | null;
  onNavigateToSlide?: (slideId: string) => void;
  lastTaskOutput?: Record<string, unknown> | null;
}

type TabId = 'generate' | 'enhance' | 'review';

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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical' as const,
  minHeight: 80,
  lineHeight: 1.5,
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" fill="none" stroke="#5f6368" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')}")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  paddingRight: 28,
  cursor: 'pointer',
};

const noSlideMessage = (
  <div style={{
    color: '#80868b',
    fontSize: 12,
    padding: '8px 0',
    textAlign: 'center',
    fontStyle: 'italic',
  }}>
    Select a slide first
  </div>
);

const inputFocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#1a73e8';
    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(26, 115, 232, 0.15)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#dadce0';
    e.currentTarget.style.boxShadow = 'none';
  },
};

const hoverBtn = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.disabled) e.currentTarget.style.background = '#1557b0';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#1a73e8';
  },
};

export const DeckAiPanel: React.FC<DeckAiPanelProps> = ({
  selectedSlideId,
  isLoading,
  previewText,
  onAiTask,
  onApprove,
  onReject,
  pendingTaskId,
  onNavigateToSlide,
  lastTaskOutput,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('generate');
  const [deckTitle, setDeckTitle] = useState('');
  const [outlineText, setOutlineText] = useState('');
  const [rewriteTone, setRewriteTone] = useState('executive');
  const [templateType, setTemplateType] = useState('title_slide');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateSubtitle, setTemplateSubtitle] = useState('');

  // Parse coach feedback from last task output
  const coachFeedback = (lastTaskOutput?.feedback as CoachFeedbackItem[] | undefined) ?? null;

  const handleCreateDeck = useCallback(() => {
    if (!deckTitle.trim() || !outlineText.trim()) return;
    const slideTitles = outlineText.split('\n').map((s) => s.trim()).filter(Boolean);
    onAiTask('create_deck_from_outline', { title: deckTitle.trim(), slideTitles });
  }, [deckTitle, outlineText, onAiTask]);

  const handleRewriteSlide = useCallback(() => {
    if (!selectedSlideId) return;
    onAiTask('rewrite_slide', { slideId: selectedSlideId, tone: rewriteTone });
  }, [selectedSlideId, rewriteTone, onAiTask]);

  const handleGenerateNotes = useCallback(() => {
    if (!selectedSlideId) return;
    onAiTask('generate_speaker_notes', { slideId: selectedSlideId });
  }, [selectedSlideId, onAiTask]);

  const handleSuggestLayout = useCallback(() => {
    if (!selectedSlideId) return;
    onAiTask('suggest_layout', { slideId: selectedSlideId });
  }, [selectedSlideId, onAiTask]);

  const handleEnhanceSlide = useCallback(() => {
    if (!selectedSlideId) return;
    onAiTask('enhance_slide', { slideId: selectedSlideId });
  }, [selectedSlideId, onAiTask]);

  const handleSimplifySlide = useCallback(() => {
    if (!selectedSlideId) return;
    onAiTask('rewrite_slide', { slideId: selectedSlideId, tone: 'concise' });
  }, [selectedSlideId, onAiTask]);

  const handleReviewDeck = useCallback(() => {
    onAiTask('slide_coach', {});
  }, [onAiTask]);

  const handleGenerateTemplate = useCallback(() => {
    onAiTask('generate_from_template', {
      templateType,
      title: templateTitle.trim() || undefined,
      subtitle: templateSubtitle.trim() || undefined,
    });
  }, [templateType, templateTitle, templateSubtitle, onAiTask]);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'generate', label: 'Generate' },
    { id: 'enhance', label: 'Enhance' },
    { id: 'review', label: 'Review' },
  ];

  const severityStyles: Record<string, React.CSSProperties> = {
    error: { background: '#fce8e6', color: '#c5221f', borderLeft: '3px solid #d93025' },
    warning: { background: '#fef7e0', color: '#b06000', borderLeft: '3px solid #f9ab00' },
    info: { background: '#e8f0fe', color: '#1967d2', borderLeft: '3px solid #1a73e8' },
  };

  const severityLabels: Record<string, string> = {
    error: 'Issue',
    warning: 'Warning',
    info: 'Tip',
  };

  return (
    <div
      style={{
        width: 280,
        borderLeft: '1px solid #dadce0',
        padding: 0,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        background: '#f8f9fa',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px 8px',
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

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e8eaed',
        padding: '0 12px',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #1a73e8' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? '#1a73e8' : '#5f6368',
              fontFamily: 'system-ui, sans-serif',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = '#3c4043';
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = '#5f6368';
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable content area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
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

        {/* ===== GENERATE TAB ===== */}
        {activeTab === 'generate' && (
          <>
            {/* Generate Deck from Outline */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                Generate Deck from Outline
              </div>
              <input
                type="text"
                placeholder="Presentation title"
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                style={inputStyle}
                {...inputFocusHandlers}
              />
              <textarea
                placeholder="Enter slide titles (one per line)"
                value={outlineText}
                onChange={(e) => setOutlineText(e.target.value)}
                style={textareaStyle}
                {...inputFocusHandlers}
              />
              <button
                onClick={handleCreateDeck}
                disabled={isLoading || !deckTitle.trim() || !outlineText.trim()}
                style={isLoading || !deckTitle.trim() || !outlineText.trim() ? disabledBtnStyle : primaryBtnStyle}
                {...hoverBtn}
              >
                {isLoading ? 'Generating...' : 'Generate Deck'}
              </button>
            </div>

            {/* Generate from Template */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                Slide from Template
              </div>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                style={selectStyle}
                {...inputFocusHandlers}
              >
                <option value="title_slide">Title Slide</option>
                <option value="section_header">Section Header</option>
                <option value="two_column">Two Column</option>
                <option value="bullet_list">Bullet List</option>
                <option value="comparison">Comparison</option>
                <option value="quote">Quote</option>
              </select>
              <input
                type="text"
                placeholder="Title (optional)"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                style={inputStyle}
                {...inputFocusHandlers}
              />
              <input
                type="text"
                placeholder="Subtitle (optional)"
                value={templateSubtitle}
                onChange={(e) => setTemplateSubtitle(e.target.value)}
                style={inputStyle}
                {...inputFocusHandlers}
              />
              <button
                onClick={handleGenerateTemplate}
                disabled={isLoading}
                style={isLoading ? disabledBtnStyle : primaryBtnStyle}
                {...hoverBtn}
              >
                {isLoading ? 'Creating...' : 'Create from Template'}
              </button>
            </div>

            {/* Generate Speaker Notes */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                Generate Speaker Notes
              </div>
              {selectedSlideId ? (
                <button
                  onClick={handleGenerateNotes}
                  disabled={isLoading}
                  style={isLoading ? disabledBtnStyle : primaryBtnStyle}
                  {...hoverBtn}
                >
                  {isLoading ? 'Generating...' : 'Generate Notes'}
                </button>
              ) : noSlideMessage}
            </div>
          </>
        )}

        {/* ===== ENHANCE TAB ===== */}
        {activeTab === 'enhance' && (
          <>
            {/* Rewrite Slide */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                Rewrite Slide
              </div>
              {selectedSlideId ? (
                <>
                  <select
                    value={rewriteTone}
                    onChange={(e) => setRewriteTone(e.target.value)}
                    style={selectStyle}
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
                    {...hoverBtn}
                  >
                    {isLoading ? 'Rewriting...' : 'Rewrite Slide Text'}
                  </button>
                </>
              ) : noSlideMessage}
            </div>

            {/* Suggest Layout */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                Suggest Layout
              </div>
              {selectedSlideId ? (
                <button
                  onClick={handleSuggestLayout}
                  disabled={isLoading}
                  style={isLoading ? disabledBtnStyle : primaryBtnStyle}
                  {...hoverBtn}
                >
                  {isLoading ? 'Analyzing...' : 'Suggest Layout Improvements'}
                </button>
              ) : noSlideMessage}
            </div>

            {/* Enhance Slide */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                Enhance Slide
              </div>
              {selectedSlideId ? (
                <button
                  onClick={handleEnhanceSlide}
                  disabled={isLoading}
                  style={isLoading ? disabledBtnStyle : primaryBtnStyle}
                  {...hoverBtn}
                >
                  {isLoading ? 'Enhancing...' : 'Add Visual Enhancements'}
                </button>
              ) : noSlideMessage}
            </div>

            {/* Simplify Slide */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                Simplify Slide
              </div>
              {selectedSlideId ? (
                <button
                  onClick={handleSimplifySlide}
                  disabled={isLoading}
                  style={isLoading ? disabledBtnStyle : primaryBtnStyle}
                  {...hoverBtn}
                >
                  {isLoading ? 'Simplifying...' : 'Condense Text'}
                </button>
              ) : noSlideMessage}
            </div>
          </>
        )}

        {/* ===== REVIEW TAB ===== */}
        {activeTab === 'review' && (
          <>
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                Review Entire Deck
              </div>
              <div style={{ fontSize: 11, color: '#5f6368', marginBottom: 10, lineHeight: 1.5 }}>
                Analyze the entire presentation for content density, consistency, missing titles, and slide count.
              </div>
              <button
                onClick={handleReviewDeck}
                disabled={isLoading}
                style={isLoading ? disabledBtnStyle : primaryBtnStyle}
                {...hoverBtn}
              >
                {isLoading ? 'Reviewing...' : 'Run Deck Review'}
              </button>
            </div>

            {/* Coach feedback items */}
            {coachFeedback && coachFeedback.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {coachFeedback.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onNavigateToSlide?.(item.slideId)}
                    style={{
                      ...(severityStyles[item.severity] ?? {}),
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      lineHeight: 1.5,
                      cursor: onNavigateToSlide ? 'pointer' : 'default',
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      {severityLabels[item.severity] ?? 'Note'} - Slide {item.slideIndex + 1}
                    </div>
                    {item.message}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

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
    </div>
  );
};
