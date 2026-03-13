import React, { useCallback } from 'react';
import type { EditableBlock } from '@opencanvas/write-editor';

interface ToolbarProps {
  focusedBlock: EditableBlock | null;
  onToggleBlockType: (blockId: string, newType: 'paragraph' | 'heading', level?: number) => void;
}

const BLOCK_OPTIONS: Array<{ label: string; type: 'paragraph' | 'heading'; level?: number }> = [
  { label: 'Paragraph', type: 'paragraph' },
  { label: 'Heading 1', type: 'heading', level: 1 },
  { label: 'Heading 2', type: 'heading', level: 2 },
  { label: 'Heading 3', type: 'heading', level: 3 },
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

export const Toolbar: React.FC<ToolbarProps> = ({ focusedBlock, onToggleBlockType }) => {
  const handleClick = useCallback(
    (type: 'paragraph' | 'heading', level?: number) => {
      if (!focusedBlock) return;
      onToggleBlockType(focusedBlock.id, type, level);
    },
    [focusedBlock, onToggleBlockType],
  );

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
      }}
    >
      {BLOCK_OPTIONS.map((opt) => {
        const active = focusedBlock ? isActive(focusedBlock, opt.type, opt.level) : false;
        return (
          <button
            key={opt.label}
            onClick={() => handleClick(opt.type, opt.level)}
            disabled={!focusedBlock}
            style={{
              padding: '4px 10px',
              border: '1px solid',
              borderColor: active ? '#4a90d9' : '#ccc',
              borderRadius: 4,
              background: active ? '#e3f0ff' : '#fff',
              color: active ? '#2a6cb8' : '#333',
              fontWeight: active ? 600 : 400,
              cursor: focusedBlock ? 'pointer' : 'default',
              opacity: focusedBlock ? 1 : 0.5,
            }}
          >
            {opt.label}
          </button>
        );
      })}
      {focusedBlock && (
        <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>
          Block: {focusedBlock.id}
        </span>
      )}
    </div>
  );
};
