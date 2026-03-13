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
        maxWidth: 720,
        margin: '0 auto',
        padding: 24,
        fontFamily: 'Georgia, serif',
        lineHeight: 1.7,
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
  );
};
