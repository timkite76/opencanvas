import React from 'react';
import type { BaseNode } from '@opencanvas/core-types';

interface ObjectToolbarProps {
  selectedObjectId: string | null;
  node: BaseNode | undefined;
  onDelete: () => void;
  onDuplicate: () => void;
  onInsertTextBox: () => void;
  onInsertRectangle: () => void;
  onInsertEllipse: () => void;
}

const btnBase: React.CSSProperties = {
  padding: '5px 12px',
  border: '1px solid #dadce0',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'system-ui, sans-serif',
  background: '#ffffff',
  color: '#3c4043',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  transition: 'background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  lineHeight: '1',
  whiteSpace: 'nowrap' as const,
};

const btnHoverHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#f1f3f4';
    e.currentTarget.style.borderColor = '#c6c9cc';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#ffffff';
    e.currentTarget.style.borderColor = '#dadce0';
  },
};

const insertBtnHoverHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(26, 115, 232, 0.08)';
    e.currentTarget.style.borderColor = '#a8c7fa';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#ffffff';
    e.currentTarget.style.borderColor = '#dadce0';
  },
};

const deleteBtnHoverHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!(e.currentTarget as HTMLButtonElement).disabled) {
      e.currentTarget.style.background = '#c5221f';
    }
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!(e.currentTarget as HTMLButtonElement).disabled) {
      e.currentTarget.style.background = '#d93025';
    }
  },
};

export const ObjectToolbar: React.FC<ObjectToolbarProps> = ({
  selectedObjectId,
  node,
  onDelete,
  onDuplicate,
  onInsertTextBox,
  onInsertRectangle,
  onInsertEllipse,
}) => {
  const anyNode = node as unknown as Record<string, unknown> | undefined;
  const nodeType = anyNode?.type as string | undefined;
  const x = anyNode?.x as number | undefined;
  const y = anyNode?.y as number | undefined;
  const w = anyNode?.width as number | undefined;
  const h = anyNode?.height as number | undefined;
  const hasSelection = selectedObjectId !== null;

  const insertBtnStyle: React.CSSProperties = {
    ...btnBase,
    color: '#1a73e8',
  };

  const disabledStyle: React.CSSProperties = {
    ...btnBase,
    opacity: 0.4,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
  };

  return (
    <div
      style={{
        padding: '6px 16px',
        borderBottom: '1px solid #dadce0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        background: '#ffffff',
        color: '#5f6368',
        flexWrap: 'wrap',
        minHeight: 40,
      }}
    >
      {/* Insert group */}
      <span style={{
        fontWeight: 600,
        fontSize: 11,
        color: '#80868b',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.3px',
        marginRight: 2,
      }}>
        Insert
      </span>
      <button
        onClick={onInsertTextBox}
        style={insertBtnStyle}
        title="Add a text box to the current slide"
        {...insertBtnHoverHandlers}
      >
        <span style={{ fontSize: 14, lineHeight: '1' }}>T</span> Text
      </button>
      <button
        onClick={onInsertRectangle}
        style={insertBtnStyle}
        title="Add a rectangle shape"
        {...insertBtnHoverHandlers}
      >
        <span style={{ fontSize: 10, lineHeight: '1', border: '1.5px solid #1a73e8', width: 12, height: 9, display: 'inline-block', borderRadius: 1 }} /> Rect
      </button>
      <button
        onClick={onInsertEllipse}
        style={insertBtnStyle}
        title="Add an ellipse shape"
        {...insertBtnHoverHandlers}
      >
        <span style={{ fontSize: 10, lineHeight: '1', border: '1.5px solid #1a73e8', width: 12, height: 10, display: 'inline-block', borderRadius: '50%' }} /> Oval
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: '#dadce0', margin: '0 4px' }} />

      {/* Selection info */}
      {hasSelection && nodeType && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '3px 10px',
          background: '#f1f3f4',
          borderRadius: 4,
          fontSize: 11,
          color: '#3c4043',
        }}>
          <span style={{ fontWeight: 600, textTransform: 'capitalize' as const }}>{nodeType}</span>
          {x !== undefined && y !== undefined && (
            <span style={{ color: '#80868b' }}>({x}, {y})</span>
          )}
          {w !== undefined && h !== undefined && (
            <span style={{ color: '#80868b' }}>{w} x {h}</span>
          )}
        </div>
      )}

      {/* Object actions - right aligned */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={onDuplicate}
          disabled={!hasSelection}
          style={hasSelection ? btnBase : disabledStyle}
          title="Duplicate selected object (Ctrl+D)"
          {...(hasSelection ? btnHoverHandlers : {})}
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          style={hasSelection ? {
            ...btnBase,
            background: '#d93025',
            color: '#ffffff',
            borderColor: '#d93025',
          } : {
            ...disabledStyle,
            background: '#d93025',
            color: '#ffffff',
            borderColor: '#d93025',
          }}
          title="Delete selected object (Delete)"
          {...(hasSelection ? deleteBtnHoverHandlers : {})}
        >
          Delete
        </button>
      </div>
    </div>
  );
};
