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

const toolbarButtonStyle: React.CSSProperties = {
  padding: '3px 10px',
  border: '1px solid #ccc',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 11,
  background: '#fff',
  color: '#333',
};

const disabledButtonStyle: React.CSSProperties = {
  ...toolbarButtonStyle,
  opacity: 0.4,
  cursor: 'default',
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

  return (
    <div
      style={{
        padding: '6px 16px',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        background: '#fafafa',
        color: '#555',
        flexWrap: 'wrap',
      }}
    >
      {/* Insert buttons - always available */}
      <span style={{ fontWeight: 600, marginRight: 4 }}>Insert:</span>
      <button
        onClick={onInsertTextBox}
        style={toolbarButtonStyle}
        title="Add a text box to the current slide"
      >
        + Text Box
      </button>
      <button
        onClick={onInsertRectangle}
        style={toolbarButtonStyle}
        title="Add a rectangle shape"
      >
        + Rectangle
      </button>
      <button
        onClick={onInsertEllipse}
        style={toolbarButtonStyle}
        title="Add an ellipse shape"
      >
        + Ellipse
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />

      {/* Selection info */}
      {hasSelection && nodeType && (
        <>
          <span>
            <strong>Selected:</strong> {nodeType}
          </span>
          {x !== undefined && y !== undefined && (
            <span>({x}, {y})</span>
          )}
          {w !== undefined && h !== undefined && (
            <span>{w} x {h}</span>
          )}
        </>
      )}

      {/* Object actions - right aligned */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button
          onClick={onDuplicate}
          disabled={!hasSelection}
          style={hasSelection ? toolbarButtonStyle : disabledButtonStyle}
          title="Duplicate selected object (Ctrl+D)"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          style={hasSelection ? {
            ...toolbarButtonStyle,
            background: '#ea4335',
            color: '#fff',
            borderColor: '#ea4335',
          } : {
            ...disabledButtonStyle,
            background: '#ea4335',
            color: '#fff',
            borderColor: '#ea4335',
          }}
          title="Delete selected object (Delete)"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
