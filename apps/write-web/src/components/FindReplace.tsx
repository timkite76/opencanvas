import React, { useRef, useEffect, useCallback } from 'react';

interface FindReplaceProps {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  matchCount: number;
  currentMatchIndex: number;
  onSearchChange: (value: string) => void;
  onReplaceChange: (value: string) => void;
  onCaseSensitiveToggle: () => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

const PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  backgroundColor: '#ffffff',
  borderBottom: '1px solid #e5e7eb',
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 13,
  flexShrink: 0,
  flexWrap: 'wrap',
};

const INPUT_STYLE: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "'Inter', system-ui, sans-serif",
  outline: 'none',
  width: 180,
  lineHeight: '20px',
};

const BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#ffffff',
  color: '#374151',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "'Inter', system-ui, sans-serif",
  cursor: 'pointer',
  lineHeight: '18px',
  whiteSpace: 'nowrap',
};

const BTN_DISABLED_STYLE: React.CSSProperties = {
  ...BTN_STYLE,
  opacity: 0.4,
  cursor: 'default',
};

const CLOSE_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: '#6b7280',
  fontSize: 16,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
};

const CHECKBOX_LABEL_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  color: '#6b7280',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const MATCH_INDICATOR_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  whiteSpace: 'nowrap',
  minWidth: 80,
  textAlign: 'center',
};

export const FindReplace: React.FC<FindReplaceProps> = ({
  searchTerm,
  replaceTerm,
  caseSensitive,
  matchCount,
  currentMatchIndex,
  onSearchChange,
  onReplaceChange,
  onCaseSensitiveToggle,
  onFindNext,
  onFindPrevious,
  onReplace,
  onReplaceAll,
  onClose,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          onFindPrevious();
        } else {
          onFindNext();
        }
      }
    },
    [onClose, onFindNext, onFindPrevious],
  );

  const hasMatches = matchCount > 0;
  const displayIndex = hasMatches ? currentMatchIndex + 1 : 0;

  return (
    <div style={PANEL_STYLE} role="search" aria-label="Find and replace" onKeyDown={handleKeyDown}>
      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find..."
          style={INPUT_STYLE}
          aria-label="Search text"
        />
        <span style={MATCH_INDICATOR_STYLE}>
          {searchTerm.length > 0
            ? `${displayIndex} of ${matchCount} matches`
            : ''}
        </span>
        <button
          onClick={onFindPrevious}
          disabled={!hasMatches}
          style={hasMatches ? BTN_STYLE : BTN_DISABLED_STYLE}
          title="Find Previous (Shift+Enter)"
          aria-label="Find previous match"
        >
          Prev
        </button>
        <button
          onClick={onFindNext}
          disabled={!hasMatches}
          style={hasMatches ? BTN_STYLE : BTN_DISABLED_STYLE}
          title="Find Next (Enter)"
          aria-label="Find next match"
        >
          Next
        </button>
      </div>

      {/* Separator */}
      <span style={{ width: 1, height: 20, backgroundColor: '#e5e7eb' }} />

      {/* Replace row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="text"
          value={replaceTerm}
          onChange={(e) => onReplaceChange(e.target.value)}
          placeholder="Replace..."
          style={INPUT_STYLE}
          aria-label="Replace text"
        />
        <button
          onClick={onReplace}
          disabled={!hasMatches}
          style={hasMatches ? BTN_STYLE : BTN_DISABLED_STYLE}
          title="Replace current match"
          aria-label="Replace current match"
        >
          Replace
        </button>
        <button
          onClick={onReplaceAll}
          disabled={!hasMatches}
          style={hasMatches ? BTN_STYLE : BTN_DISABLED_STYLE}
          title="Replace all matches"
          aria-label="Replace all matches"
        >
          Replace All
        </button>
      </div>

      {/* Separator */}
      <span style={{ width: 1, height: 20, backgroundColor: '#e5e7eb' }} />

      {/* Options */}
      <label style={CHECKBOX_LABEL_STYLE}>
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={onCaseSensitiveToggle}
          style={{ margin: 0 }}
        />
        Case sensitive
      </label>

      {/* Close button */}
      <button
        onClick={onClose}
        style={CLOSE_BTN_STYLE}
        title="Close (Escape)"
        aria-label="Close find and replace"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        &#x2715;
      </button>
    </div>
  );
};
