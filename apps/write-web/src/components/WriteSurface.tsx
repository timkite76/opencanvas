import React, { useCallback } from 'react';
import type { EditableBlock, CanonicalSelection } from '@opencanvas/write-editor';
import { BlockEditor } from './BlockEditor.js';

interface WriteSurfaceProps {
  blocks: EditableBlock[];
  focusedBlockId: string | null;
  onBlockTextChange: (blockId: string, newText: string) => void;
  onSelectionChange: (selection: CanonicalSelection | null) => void;
  onBlockFocus: (blockId: string) => void;
}

export const WriteSurface: React.FC<WriteSurfaceProps> = ({
  blocks,
  focusedBlockId,
  onBlockTextChange,
  onSelectionChange,
  onBlockFocus,
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
      {blocks.map((block) => (
        <BlockEditor
          key={block.id}
          block={block}
          isSelected={block.id === focusedBlockId}
          onTextChange={onBlockTextChange}
          onSelectionChange={onSelectionChange}
          onFocus={onBlockFocus}
        />
      ))}
    </div>
  );
};
