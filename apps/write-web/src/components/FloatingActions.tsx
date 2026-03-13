import React, { useState, useEffect, useRef, useCallback } from 'react';

interface FloatingActionsProps {
  isVisible: boolean;
  onAction: (action: string) => void;
  isLoading: boolean;
}

const ACTIONS = [
  { id: 'rewrite', label: 'Rewrite', icon: '\u270D' },
  { id: 'expand', label: 'Expand', icon: '\u2194' },
  { id: 'condense', label: 'Condense', icon: '\u2199' },
  { id: 'fix_grammar', label: 'Fix Grammar', icon: '\u2714' },
  { id: 'simplify', label: 'Simplify', icon: '\u2B50' },
] as const;

const toolbarStyle: React.CSSProperties = {
  position: 'fixed',
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '4px 6px',
  backgroundColor: '#1f2937',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
  zIndex: 1000,
  transition: 'opacity 0.15s ease, transform 0.15s ease',
  fontFamily: "'Inter', system-ui, sans-serif",
};

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 10px',
  border: 'none',
  borderRadius: 5,
  background: 'transparent',
  color: '#e5e7eb',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "'Inter', system-ui, sans-serif",
  cursor: 'pointer',
  transition: 'background-color 0.1s ease, color 0.1s ease',
  whiteSpace: 'nowrap',
};

const buttonHoverStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#374151',
  color: '#ffffff',
};

const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const spinnerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  border: '2px solid #4b5563',
  borderTopColor: '#60a5fa',
  borderRadius: '50%',
  animation: 'floating-spin 0.7s linear infinite',
  marginLeft: 4,
  marginRight: 4,
};

export const FloatingActions: React.FC<FloatingActionsProps> = ({
  isVisible,
  onAction,
  isLoading,
}) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setPosition(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      return;
    }

    // Position above the selection, centered
    const toolbarWidth = toolbarRef.current?.offsetWidth ?? 360;
    const top = rect.top - 44;
    let left = rect.left + rect.width / 2 - toolbarWidth / 2;

    // Keep within viewport bounds
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
    const clampedTop = Math.max(8, top);

    setPosition({ top: clampedTop, left });
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setPosition(null);
      return;
    }

    // Small delay to let selection settle
    const timer = setTimeout(updatePosition, 50);
    return () => clearTimeout(timer);
  }, [isVisible, updatePosition]);

  // Update position on scroll
  useEffect(() => {
    if (!isVisible || !position) return;

    const handleScroll = () => {
      requestAnimationFrame(updatePosition);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isVisible, position, updatePosition]);

  if (!isVisible || !position) return null;

  return (
    <>
      <style>{`@keyframes floating-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        ref={toolbarRef}
        style={{
          ...toolbarStyle,
          top: position.top,
          left: position.left,
        }}
        role="toolbar"
        aria-label="AI writing actions"
        onMouseDown={(e) => {
          // Prevent toolbar clicks from clearing the selection
          e.preventDefault();
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 8px', gap: 6 }}>
            <div style={spinnerStyle} />
            <span style={{ color: '#9ca3af', fontSize: 12 }}>Processing...</span>
          </div>
        ) : (
          ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={isLoading}
              style={
                isLoading
                  ? buttonDisabledStyle
                  : hoveredId === action.id
                    ? buttonHoverStyle
                    : buttonStyle
              }
              onMouseEnter={() => setHoveredId(action.id)}
              onMouseLeave={() => setHoveredId(null)}
              aria-label={action.label}
            >
              <span style={{ fontSize: 13 }}>{action.icon}</span>
              {action.label}
            </button>
          ))
        )}
      </div>
    </>
  );
};
