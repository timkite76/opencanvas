import React, { useCallback } from 'react';
import type { EditableBlock } from '@opencanvas/write-editor';

interface ToolbarProps {
  focusedBlock: EditableBlock | null;
  onToggleBlockType: (blockId: string, newType: 'paragraph' | 'heading', level?: number) => void;
  onToggleList: (blockId: string, listType: 'bullet' | 'ordered') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const BLOCK_OPTIONS: Array<{ label: string; shortLabel: string; type: 'paragraph' | 'heading'; level?: number }> = [
  { label: 'Paragraph', shortLabel: 'P', type: 'paragraph' },
  { label: 'Heading 1', shortLabel: 'H1', type: 'heading', level: 1 },
  { label: 'Heading 2', shortLabel: 'H2', type: 'heading', level: 2 },
  { label: 'Heading 3', shortLabel: 'H3', type: 'heading', level: 3 },
];

interface InlineFormatOption {
  label: string;
  displayLabel: React.ReactNode;
  command: string;
  title: string;
}

const INLINE_FORMAT_OPTIONS: InlineFormatOption[] = [
  { label: 'Bold', displayLabel: 'B', command: 'bold', title: 'Bold (Ctrl+B)' },
  { label: 'Italic', displayLabel: 'I', command: 'italic', title: 'Italic (Ctrl+I)' },
  { label: 'Underline', displayLabel: 'U', command: 'underline', title: 'Underline (Ctrl+U)' },
  { label: 'Strikethrough', displayLabel: 'S', command: 'strikeThrough', title: 'Strikethrough' },
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

/** Shared toolbar button styles */
const toolbarBtnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 32,
  minWidth: 32,
  padding: '0 10px',
  border: '1px solid transparent',
  borderRadius: 4,
  background: 'transparent',
  color: '#4b5563',
  fontWeight: 500,
  fontSize: 13,
  fontFamily: "'Inter', system-ui, sans-serif",
  cursor: 'pointer',
  transition: 'all 0.12s ease',
  lineHeight: 1,
};

export const Toolbar: React.FC<ToolbarProps> = ({
  focusedBlock,
  onToggleBlockType,
  onToggleList,
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

  const handleListClick = useCallback(
    (listType: 'bullet' | 'ordered') => {
      if (!focusedBlock) return;
      onToggleList(focusedBlock.id, listType);
    },
    [focusedBlock, onToggleList],
  );

  const handleInlineFormat = useCallback((command: string) => {
    document.execCommand(command, false);
  }, []);

  const getButtonStyle = (isDisabled: boolean, isActiveState: boolean): React.CSSProperties => {
    if (isDisabled) {
      return {
        ...toolbarBtnBase,
        opacity: 0.35,
        cursor: 'default',
      };
    }
    if (isActiveState) {
      return {
        ...toolbarBtnBase,
        backgroundColor: '#e8f0fe',
        color: '#1a73e8',
        fontWeight: 600,
      };
    }
    return toolbarBtnBase;
  };

  const getInlineStyle = (command: string): React.CSSProperties => {
    const base: React.CSSProperties = {};
    switch (command) {
      case 'bold': base.fontWeight = 700; break;
      case 'italic': base.fontStyle = 'italic'; break;
      case 'underline': base.textDecoration = 'underline'; break;
      case 'strikeThrough': base.textDecoration = 'line-through'; break;
    }
    return base;
  };

  const separator: React.CSSProperties = {
    width: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
    margin: '0 6px',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '6px 16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 13,
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Undo / Redo group */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        style={getButtonStyle(!canUndo, false)}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        onMouseEnter={(e) => { if (canUndo) { e.currentTarget.style.backgroundColor = '#f3f4f6'; } }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        &#x21A9;
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        style={getButtonStyle(!canRedo, false)}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        onMouseEnter={(e) => { if (canRedo) { e.currentTarget.style.backgroundColor = '#f3f4f6'; } }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        &#x21AA;
      </button>

      {/* Separator */}
      <span style={separator} />

      {/* Block type buttons */}
      {BLOCK_OPTIONS.map((opt) => {
        const active = focusedBlock ? isActive(focusedBlock, opt.type, opt.level) : false;
        const disabled = !focusedBlock;
        return (
          <button
            key={opt.label}
            onClick={() => handleBlockClick(opt.type, opt.level)}
            disabled={disabled}
            style={getButtonStyle(disabled, active)}
            title={opt.label}
            onMouseEnter={(e) => { if (!disabled && !active) { e.currentTarget.style.backgroundColor = '#f3f4f6'; } }}
            onMouseLeave={(e) => { if (!disabled && !active) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
          >
            {opt.shortLabel}
          </button>
        );
      })}

      {/* Separator */}
      <span style={separator} />

      {/* List buttons */}
      {(() => {
        const bulletActive = focusedBlock?.type === 'list_item' && focusedBlock.listType === 'bullet';
        const orderedActive = focusedBlock?.type === 'list_item' && focusedBlock.listType === 'ordered';
        const disabled = !focusedBlock;
        return (
          <>
            <button
              onClick={() => handleListClick('bullet')}
              disabled={disabled}
              style={getButtonStyle(disabled, bulletActive)}
              title="Bullet List"
              aria-label="Bullet List"
              onMouseEnter={(e) => { if (!disabled && !bulletActive) { e.currentTarget.style.backgroundColor = '#f3f4f6'; } }}
              onMouseLeave={(e) => { if (!disabled && !bulletActive) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
            >
              &#x2022; List
            </button>
            <button
              onClick={() => handleListClick('ordered')}
              disabled={disabled}
              style={getButtonStyle(disabled, orderedActive)}
              title="Numbered List"
              aria-label="Numbered List"
              onMouseEnter={(e) => { if (!disabled && !orderedActive) { e.currentTarget.style.backgroundColor = '#f3f4f6'; } }}
              onMouseLeave={(e) => { if (!disabled && !orderedActive) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
            >
              1. List
            </button>
          </>
        );
      })()}

      {/* Separator */}
      <span style={separator} />

      {/* Inline formatting buttons */}
      {INLINE_FORMAT_OPTIONS.map((opt) => {
        const disabled = !focusedBlock;
        return (
          <button
            key={opt.command}
            onClick={() => handleInlineFormat(opt.command)}
            disabled={disabled}
            style={{
              ...getButtonStyle(disabled, false),
              ...getInlineStyle(opt.command),
              minWidth: 32,
              padding: '0 6px',
            }}
            title={opt.title}
            aria-label={opt.label}
            onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.backgroundColor = '#f3f4f6'; } }}
            onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
          >
            {opt.displayLabel}
          </button>
        );
      })}

      {focusedBlock && (
        <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif" }}>
          {focusedBlock.type === 'heading'
            ? `Heading ${focusedBlock.level ?? 1}`
            : focusedBlock.type === 'list_item'
              ? `${focusedBlock.listType === 'ordered' ? 'Numbered' : 'Bullet'} List`
              : 'Paragraph'}
        </span>
      )}
    </div>
  );
};
