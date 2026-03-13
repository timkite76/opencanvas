import React, { useState, useCallback } from 'react';
import { AiUsageStats } from './AiUsageStats.js';

type AiTab = 'formula' | 'analyze' | 'transform';

interface GridAiPanelProps {
  selectedCellId: string | null;
  selectedCellAddress: string | null;
  onGenerateFormula: (description: string) => void;
  onExplainFormula: () => void;
  isLoading: boolean;
  previewText: string | null;
  onApprove: () => void;
  onReject: () => void;
  /** New: callback for analyze_data */
  onAnalyzeData?: (rangeDescription: string) => void;
  /** New: callback for smart_fill */
  onSmartFill?: (sourceRange: string, targetRange: string) => void;
  /** New: callback for clean_data */
  onCleanData?: (rangeDescription: string) => void;
  /** New: callback for suggest_chart */
  onSuggestChart?: (rangeDescription: string) => void;
  /** Currently selected range as a string, e.g. "A1:C5" */
  selectedRangeLabel?: string | null;
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

const TAB_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  fontSize: 11,
  fontWeight: 500,
  fontFamily: panelFont,
  border: 'none',
  cursor: 'pointer',
  background: 'transparent',
  color: '#5f6368',
  borderBottom: '2px solid transparent',
  transition: 'color 0.15s, border-color 0.15s',
};

const TAB_ACTIVE_STYLE: React.CSSProperties = {
  ...TAB_STYLE,
  color: '#1a73e8',
  borderBottomColor: '#1a73e8',
  fontWeight: 600,
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
  onAnalyzeData,
  onSmartFill,
  onCleanData,
  onSuggestChart,
  selectedRangeLabel,
}) => {
  const [activeTab, setActiveTab] = useState<AiTab>('formula');
  const [description, setDescription] = useState('');
  const [genHovered, setGenHovered] = useState(false);
  const [explainHovered, setExplainHovered] = useState(false);

  // Analyze tab state
  const [analyzeRange, setAnalyzeRange] = useState('');

  // Transform tab state
  const [smartFillSource, setSmartFillSource] = useState('');
  const [smartFillTarget, setSmartFillTarget] = useState('');
  const [cleanRange, setCleanRange] = useState('');
  const [chartRange, setChartRange] = useState('');

  // Auto-fill range inputs from selection
  const effectiveAnalyzeRange = analyzeRange || selectedRangeLabel || '';
  const effectiveCleanRange = cleanRange || selectedRangeLabel || '';
  const effectiveChartRange = chartRange || selectedRangeLabel || '';

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

  const handleAnalyze = useCallback(() => {
    const range = effectiveAnalyzeRange.trim();
    if (range && onAnalyzeData) {
      onAnalyzeData(range);
    }
  }, [effectiveAnalyzeRange, onAnalyzeData]);

  const handleSmartFill = useCallback(() => {
    const source = smartFillSource.trim();
    const target = smartFillTarget.trim();
    if (source && target && onSmartFill) {
      onSmartFill(source, target);
    }
  }, [smartFillSource, smartFillTarget, onSmartFill]);

  const handleClean = useCallback(() => {
    const range = effectiveCleanRange.trim();
    if (range && onCleanData) {
      onCleanData(range);
    }
  }, [effectiveCleanRange, onCleanData]);

  const handleSuggestChart = useCallback(() => {
    const range = effectiveChartRange.trim();
    if (range && onSuggestChart) {
      onSuggestChart(range);
    }
  }, [effectiveChartRange, onSuggestChart]);

  const renderResponseCard = () => {
    if (!previewText) return null;
    return (
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
    );
  };

  const renderFormulaTab = () => (
    <>
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
    </>
  );

  const renderAnalyzeTab = () => (
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
        Analyze Selection
      </label>
      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#5f6368', lineHeight: 1.4 }}>
        Get statistics, trend analysis, and outlier detection for a data range.
      </p>
      <input
        type="text"
        value={analyzeRange || selectedRangeLabel || ''}
        onChange={(e) => setAnalyzeRange(e.target.value)}
        placeholder="e.g. A1:A20 or B2:D10"
        style={{
          width: '100%',
          height: 30,
          border: '1px solid #dadce0',
          borderRadius: 6,
          padding: '0 10px',
          fontSize: 12,
          fontFamily: panelFont,
          boxSizing: 'border-box',
          outline: 'none',
          marginBottom: 8,
          color: '#202124',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#1a73e8';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#dadce0';
        }}
      />
      <button
        onClick={handleAnalyze}
        disabled={isLoading || !effectiveAnalyzeRange.trim()}
        style={{
          ...AI_BUTTON_PRIMARY,
          background: isLoading || !effectiveAnalyzeRange.trim() ? '#c2d9f2' : '#1a73e8',
          cursor: isLoading || !effectiveAnalyzeRange.trim() ? 'default' : 'pointer',
        }}
      >
        {isLoading ? 'Analyzing...' : 'Analyze Data'}
      </button>
    </div>
  );

  const renderTransformTab = () => (
    <>
      {/* Smart Fill */}
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
          Smart Fill
        </label>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#5f6368', lineHeight: 1.4 }}>
          Detect patterns and fill target cells automatically.
        </p>
        <input
          type="text"
          value={smartFillSource}
          onChange={(e) => setSmartFillSource(e.target.value)}
          placeholder="Source range, e.g. A1:A5"
          style={{
            width: '100%',
            height: 28,
            border: '1px solid #dadce0',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 12,
            fontFamily: panelFont,
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 6,
            color: '#202124',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#1a73e8';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#dadce0';
          }}
        />
        <input
          type="text"
          value={smartFillTarget}
          onChange={(e) => setSmartFillTarget(e.target.value)}
          placeholder="Target range, e.g. A6:A10"
          style={{
            width: '100%',
            height: 28,
            border: '1px solid #dadce0',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 12,
            fontFamily: panelFont,
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 8,
            color: '#202124',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#1a73e8';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#dadce0';
          }}
        />
        <button
          onClick={handleSmartFill}
          disabled={isLoading || !smartFillSource.trim() || !smartFillTarget.trim()}
          style={{
            ...AI_BUTTON_PRIMARY,
            background:
              isLoading || !smartFillSource.trim() || !smartFillTarget.trim()
                ? '#c2d9f2'
                : '#1a73e8',
            cursor:
              isLoading || !smartFillSource.trim() || !smartFillTarget.trim()
                ? 'default'
                : 'pointer',
          }}
        >
          {isLoading ? 'Filling...' : 'Smart Fill'}
        </button>
      </div>

      {/* Clean Data */}
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
          Clean Data
        </label>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#5f6368', lineHeight: 1.4 }}>
          Fix whitespace, normalize capitalization, detect duplicates.
        </p>
        <input
          type="text"
          value={cleanRange || selectedRangeLabel || ''}
          onChange={(e) => setCleanRange(e.target.value)}
          placeholder="e.g. A1:A20"
          style={{
            width: '100%',
            height: 28,
            border: '1px solid #dadce0',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 12,
            fontFamily: panelFont,
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 8,
            color: '#202124',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#1a73e8';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#dadce0';
          }}
        />
        <button
          onClick={handleClean}
          disabled={isLoading || !effectiveCleanRange.trim()}
          style={{
            ...AI_BUTTON_SECONDARY,
            background: isLoading || !effectiveCleanRange.trim() ? '#f8f9fa' : '#ffffff',
            cursor: isLoading || !effectiveCleanRange.trim() ? 'default' : 'pointer',
          }}
        >
          {isLoading ? 'Cleaning...' : 'Clean Data'}
        </button>
      </div>

      {/* Suggest Chart */}
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
          Suggest Chart
        </label>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#5f6368', lineHeight: 1.4 }}>
          Get a recommendation for the best chart type for your data.
        </p>
        <input
          type="text"
          value={chartRange || selectedRangeLabel || ''}
          onChange={(e) => setChartRange(e.target.value)}
          placeholder="e.g. A1:B10"
          style={{
            width: '100%',
            height: 28,
            border: '1px solid #dadce0',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 12,
            fontFamily: panelFont,
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 8,
            color: '#202124',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#1a73e8';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#dadce0';
          }}
        />
        <button
          onClick={handleSuggestChart}
          disabled={isLoading || !effectiveChartRange.trim()}
          style={{
            ...AI_BUTTON_SECONDARY,
            background: isLoading || !effectiveChartRange.trim() ? '#f8f9fa' : '#ffffff',
            cursor: isLoading || !effectiveChartRange.trim() ? 'default' : 'pointer',
          }}
        >
          {isLoading ? 'Analyzing...' : 'Suggest Chart'}
        </button>
      </div>
    </>
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
            {selectedRangeLabel && (
              <>
                <span style={{ fontSize: 11, color: '#5f6368', marginLeft: 8 }}>Range:</span>
                <span>{selectedRangeLabel}</span>
              </>
            )}
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #e8eaed',
              gap: 0,
            }}
          >
            {(
              [
                ['formula', 'Formula'],
                ['analyze', 'Analyze'],
                ['transform', 'Transform'],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={activeTab === tab ? TAB_ACTIVE_STYLE : TAB_STYLE}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'formula' && renderFormulaTab()}
          {activeTab === 'analyze' && renderAnalyzeTab()}
          {activeTab === 'transform' && renderTransformTab()}

          {/* AI Response card (shared across tabs) */}
          {renderResponseCard()}
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

      {/* Usage stats */}
      <div style={{ marginTop: 'auto' }}>
        <AiUsageStats />
      </div>
    </div>
  );
};
