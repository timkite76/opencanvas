import React from 'react';
import type { EditableBlock, CanonicalSelection } from '@opencanvas/write-editor';
import { BlockEditor } from './BlockEditor.js';

interface WriteSurfaceProps {
  blocks: EditableBlock[];
  focusedBlockId: string | null;
  localTextOverrides: Map<string, string>;
  onBlockTextChange: (blockId: string, newText: string) => void;
  onSelectionChange: (selection: CanonicalSelection | null) => void;
  onBlockFocus: (blockId: string) => void;
  onInsertBlockAfter: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
}

export const WriteSurface: React.FC<WriteSurfaceProps> = ({
  blocks,
  focusedBlockId,
  localTextOverrides,
  onBlockTextChange,
  onSelectionChange,
  onBlockFocus,
  onInsertBlockAfter,
  onDeleteBlock,
}) => {
  return (
    <div
      style={{
        padding: '40px 0',
        backgroundColor: '#f1f3f5',
        minHeight: '100%',
      }}
    >
      <div
        style={{
          maxWidth: 816,
          minHeight: 'calc(100vh - 200px)',
          margin: '0 auto',
          padding: '60px 80px',
          fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
          lineHeight: 1.8,
          fontSize: 16,
          color: '#1a1a1a',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.04)',
          borderRadius: 2,
        }}
      >
        {blocks.map((block) => {
          // Use local text override if available (during debounce), otherwise adapter text
          const displayText = localTextOverrides.has(block.id)
            ? localTextOverrides.get(block.id)!
            : block.text;
          const displayBlock = displayText !== block.text
            ? { ...block, text: displayText }
            : block;

          return (
            <BlockEditor
              key={block.id}
              block={displayBlock}
              isSelected={block.id === focusedBlockId}
              onTextChange={onBlockTextChange}
              onSelectionChange={onSelectionChange}
              onFocus={onBlockFocus}
              onInsertBlockAfter={onInsertBlockAfter}
              onDeleteBlock={onDeleteBlock}
            />
          );
        })}
      </div>
    </div>
  );
};
