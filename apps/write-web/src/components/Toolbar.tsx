import React, { useCallback } from 'react';
import type { EditableBlock } from '@opencanvas/write-editor';

interface ToolbarProps {
  focusedBlock: EditableBlock | null;
  onToggleBlockType: (blockId: string, newType: 'paragraph' | 'heading', level?: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const BLOCK_OPTIONS: Array<{ label: string; type: 'paragraph' | 'heading'; level?: number }> = [
  { label: 'Paragraph', type: 'paragraph' },
  { label: 'Heading 1', type: 'heading', level: 1 },
  { label: 'Heading 2', type: 'heading', level: 2 },
  { label: 'Heading 3', type: 'heading', level: 3 },
];

interface InlineFormatOption {
  label: string;
  command: string;
  style: React.CSSProperties;
}

const INLINE_FORMAT_OPTIONS: InlineFormatOption[] = [
  { label: 'B', command: 'bold', style: { fontWeight: 700 } },
  { label: 'I', command: 'italic', style: { fontStyle: 'italic' } },
  { label: 'U', command: 'underline', style: { textDecoration: 'underline' } },
  { label: 'S', command: 'strikeThrough', style: { textDecoration: 'line-through' } },
];

function isActive(
  block: EditableBlock,
  optionType: 'paragraph' | 'heading',
  optionLevel?: number,
): boolean {
  if (block.type !== optionType) return false;
  if (optionType === 'heading') return block.level === optionLevel;
  return true;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  focusedBlock,
  onToggleBlockType,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const handleBlockClick = useCallback(
    (type: 'paragraph' | 'heading', level?: number) => {
      if (!focusedBlock) return;
      onToggleBlockType(focusedBlock.id, type, level);
    },
    [focusedBlock, onToggleBlockType],
  );

  const handleInlineFormat = useCallback((command: string) => {
    document.execCommand(command, false);
  }, []);

  const buttonBase: React.CSSProperties = {
    padding: '4px 10px',
    border: '1px solid #ccc',
    borderRadius: 4,
    background: '#fff',
    color: '#333',
    fontWeight: 400,
    cursor: 'pointer',
  };

  const activeButton: React.CSSProperties = {
    ...buttonBase,
    borderColor: '#4a90d9',
    background: '#e3f0ff',
    color: '#2a6cb8',
    fontWeight: 600,
  };

  const disabledButton: React.CSSProperties = {
    ...buttonBase,
    opacity: 0.5,
    cursor: 'default',
  };

  return (
    <div
      style={{
        padding: '4px 16px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        background: '#fafafa',
        flexWrap: 'wrap',
      }}
    >
      {/* Undo / Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        style={canUndo ? buttonBase : disabledButton}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        &#x21A9;
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        style={canRedo ? buttonBase : disabledButton}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        &#x21AA;
      </button>

      {/* Separator */}
      <span style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />

      {/* Block type buttons */}
      {BLOCK_OPTIONS.map((opt) => {
        const active = focusedBlock ? isActive(focusedBlock, opt.type, opt.level) : false;
        return (
          <button
            key={opt.label}
            onClick={() => handleBlockClick(opt.type, opt.level)}
            disabled={!focusedBlock}
            style={
              !focusedBlock
                ? disabledButton
                : active
                  ? activeButton
                  : buttonBase
            }
          >
            {opt.label}
          </button>
        );
      })}

      {/* Separator */}
      <span style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />

      {/* Inline formatting buttons */}
      {INLINE_FORMAT_OPTIONS.map((opt) => (
        <button
          key={opt.command}
          onClick={() => handleInlineFormat(opt.command)}
          disabled={!focusedBlock}
          style={{
            ...(focusedBlock ? buttonBase : disabledButton),
            ...opt.style,
            minWidth: 30,
            textAlign: 'center' as const,
          }}
          title={`${opt.label} (Ctrl+${opt.label})`}
          aria-label={opt.command}
        >
          {opt.label}
        </button>
      ))}

      {focusedBlock && (
        <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>
          Block: {focusedBlock.id}
        </span>
      )}
    </div>
  );
};
