import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { BaseNode } from '@opencanvas/core-types';

interface ObjectToolbarProps {
  selectedObjectId: string | null;
  node: BaseNode | undefined;
  onDelete: () => void;
  onDuplicate: () => void;
  onInsertTextBox: () => void;
  onInsertRectangle: () => void;
  onInsertEllipse: () => void;
  onUpdateNodePatch?: (nodeId: string, patch: Record<string, unknown>) => void;
  onAiRewrite?: (tone: string) => void;
}

const COLOR_PALETTE = [
  { label: 'Black',       value: '#000000' },
  { label: 'White',       value: '#ffffff' },
  { label: 'Red',         value: '#d93025' },
  { label: 'Orange',      value: '#e8710a' },
  { label: 'Yellow',      value: '#f9ab00' },
  { label: 'Green',       value: '#1e8e3e' },
  { label: 'Blue',        value: '#1a73e8' },
  { label: 'Purple',      value: '#9334e6' },
  { label: 'Pink',        value: '#e52592' },
  { label: 'Gray',        value: '#9e9e9e' },
  { label: 'Brown',       value: '#795548' },
  { label: 'Teal',        value: '#009688' },
  { label: 'Transparent', value: 'transparent' },
];

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

interface ColorPickerPopoverProps {
  currentColor: string;
  label: string;
  onColorSelect: (color: string) => void;
}

const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({ currentColor, label, onColorSelect }) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...btnBase,
          gap: 6,
          padding: '4px 8px',
        }}
        title={label}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f3f4'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
      >
        <span style={{ fontSize: 11, color: '#5f6368' }}>{label}</span>
        <span style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          border: '1px solid #dadce0',
          background: currentColor === 'transparent'
            ? 'repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%) 50% / 8px 8px'
            : currentColor,
          display: 'inline-block',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 8, color: '#80868b' }}>&#x25BC;</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: '#ffffff',
          border: '1px solid #dadce0',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          padding: 8,
          zIndex: 100,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 4,
          width: 160,
        }}>
          {COLOR_PALETTE.map((color) => {
            const isActive = currentColor === color.value;
            const isTransparent = color.value === 'transparent';
            return (
              <button
                key={color.value}
                onClick={() => {
                  onColorSelect(color.value);
                  setOpen(false);
                }}
                title={color.label}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  border: isActive
                    ? '2px solid #1a73e8'
                    : '1px solid #e0e0e0',
                  background: isTransparent
                    ? 'repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                    : color.value,
                  cursor: 'pointer',
                  padding: 0,
                  boxShadow: isActive ? '0 0 0 2px rgba(26, 115, 232, 0.3)' : 'none',
                  transition: 'box-shadow 0.1s ease, border-color 0.1s ease',
                  position: 'relative',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const AI_REWRITE_TONES = [
  { value: 'executive', label: 'Executive' },
  { value: 'concise', label: 'Concise' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
];

interface AiRewritePopoverProps {
  onSelectTone: (tone: string) => void;
}

const AiRewritePopover: React.FC<AiRewritePopoverProps> = ({ onSelectTone }) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...btnBase,
          background: 'linear-gradient(135deg, #8e24aa, #e040fb)',
          color: '#ffffff',
          borderColor: '#8e24aa',
          gap: 6,
          padding: '4px 10px',
        }}
        title="AI Rewrite - rewrite this text box in a specific tone"
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        <span style={{ fontSize: 10, fontWeight: 700 }}>AI</span> Rewrite
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: '#ffffff',
          border: '1px solid #dadce0',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          padding: 4,
          zIndex: 100,
          minWidth: 140,
        }}>
          <div style={{
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 600,
            color: '#80868b',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.3px',
          }}>
            Select Tone
          </div>
          {AI_REWRITE_TONES.map((tone) => (
            <button
              key={tone.value}
              onClick={() => {
                onSelectTone(tone.value);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 10px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'system-ui, sans-serif',
                color: '#3c4043',
                textAlign: 'left',
                borderRadius: 4,
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f3f4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              {tone.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ObjectToolbar: React.FC<ObjectToolbarProps> = ({
  selectedObjectId,
  node,
  onDelete,
  onDuplicate,
  onInsertTextBox,
  onInsertRectangle,
  onInsertEllipse,
  onUpdateNodePatch,
  onAiRewrite,
}) => {
  const anyNode = node as unknown as Record<string, unknown> | undefined;
  const nodeType = anyNode?.type as string | undefined;
  const x = anyNode?.x as number | undefined;
  const y = anyNode?.y as number | undefined;
  const w = anyNode?.width as number | undefined;
  const h = anyNode?.height as number | undefined;
  const hasSelection = selectedObjectId !== null;

  // Current colors from the selected node
  const currentFill = (anyNode?.fill as string) ?? 'transparent';
  const currentStroke = (anyNode?.stroke as string) ?? 'transparent';
  const currentTextColor = (anyNode?.textColor as string) ?? '#000000';

  const handleFillChange = useCallback((color: string) => {
    if (!selectedObjectId || !onUpdateNodePatch) return;
    onUpdateNodePatch(selectedObjectId, { fill: color });
  }, [selectedObjectId, onUpdateNodePatch]);

  const handleStrokeChange = useCallback((color: string) => {
    if (!selectedObjectId || !onUpdateNodePatch) return;
    onUpdateNodePatch(selectedObjectId, { stroke: color });
  }, [selectedObjectId, onUpdateNodePatch]);

  const handleTextColorChange = useCallback((color: string) => {
    if (!selectedObjectId || !onUpdateNodePatch) return;
    onUpdateNodePatch(selectedObjectId, { textColor: color });
  }, [selectedObjectId, onUpdateNodePatch]);

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

  const showShapeColors = hasSelection && (nodeType === 'shape' || nodeType === 'image_object');
  const showTextColor = hasSelection && nodeType === 'textbox';

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

      {/* Color pickers for shapes */}
      {showShapeColors && (
        <>
          <div style={{ width: 1, height: 24, background: '#dadce0', margin: '0 2px' }} />
          <ColorPickerPopover
            label="Fill"
            currentColor={currentFill}
            onColorSelect={handleFillChange}
          />
          <ColorPickerPopover
            label="Stroke"
            currentColor={currentStroke}
            onColorSelect={handleStrokeChange}
          />
        </>
      )}

      {/* Color pickers for textboxes */}
      {showTextColor && (
        <>
          <div style={{ width: 1, height: 24, background: '#dadce0', margin: '0 2px' }} />
          <ColorPickerPopover
            label="Fill"
            currentColor={currentFill}
            onColorSelect={handleFillChange}
          />
          <ColorPickerPopover
            label="Text"
            currentColor={currentTextColor}
            onColorSelect={handleTextColorChange}
          />
          <ColorPickerPopover
            label="Stroke"
            currentColor={currentStroke}
            onColorSelect={handleStrokeChange}
          />
          {onAiRewrite && (
            <>
              <div style={{ width: 1, height: 24, background: '#dadce0', margin: '0 2px' }} />
              <AiRewritePopover onSelectTone={onAiRewrite} />
            </>
          )}
        </>
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
