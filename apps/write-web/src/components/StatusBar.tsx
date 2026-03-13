import React from 'react';
import type { EditableBlock } from '@opencanvas/write-editor';

interface StatusBarProps {
  blocks: EditableBlock[];
  focusedBlock: EditableBlock | null;
  isDirty: boolean;
}

function countWordsAndChars(blocks: EditableBlock[]): { words: number; characters: number } {
  let characters = 0;
  let words = 0;
  for (const block of blocks) {
    const text = block.text;
    characters += text.length;
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      words += trimmed.split(/\s+/).length;
    }
  }
  return { words, characters };
}

function getBlockTypeLabel(block: EditableBlock | null): string {
  if (!block) return '--';
  if (block.type === 'heading') return `Heading ${block.level ?? 1}`;
  return 'Paragraph';
}

export const StatusBar: React.FC<StatusBarProps> = ({ blocks, focusedBlock, isDirty }) => {
  const { words, characters } = countWordsAndChars(blocks);

  const separatorStyle: React.CSSProperties = {
    width: 1,
    height: 12,
    backgroundColor: '#d1d5db',
    margin: '0 2px',
  };

  return (
    <div
      style={{
        padding: '4px 16px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11,
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <span>{words} word{words !== 1 ? 's' : ''}</span>
      <span style={separatorStyle} />
      <span>{characters} character{characters !== 1 ? 's' : ''}</span>
      <span style={separatorStyle} />
      <span>{getBlockTypeLabel(focusedBlock)}</span>
      <span style={{ marginLeft: 'auto' }}>
        {isDirty ? 'Unsaved changes' : 'Ready'}
      </span>
    </div>
  );
};
