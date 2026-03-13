import React, { useRef, useCallback } from 'react';
import type { EditableBlock, CanonicalSelection } from '@opencanvas/write-editor';

interface BlockEditorProps {
  block: EditableBlock;
  isSelected: boolean;
  onTextChange: (blockId: string, newText: string) => void;
  onSelectionChange: (selection: CanonicalSelection | null) => void;
  onFocus: (blockId: string) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  isSelected,
  onTextChange,
  onSelectionChange,
  onFocus,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    const newText = ref.current.textContent ?? '';
    onTextChange(block.id, newText);
  }, [block.id, onTextChange]);

  const handleSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) {
      onSelectionChange(null);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.startContainer)) {
      onSelectionChange(null);
      return;
    }

    const preRange = document.createRange();
    preRange.selectNodeContents(ref.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;

    preRange.setEnd(range.endContainer, range.endOffset);
    const endOffset = preRange.toString().length;

    onSelectionChange({
      objectId: block.id,
      startOffset,
      endOffset,
    });
  }, [block.id, onSelectionChange, ref]);

  const handleFocus = useCallback(() => {
    onFocus(block.id);
  }, [block.id, onFocus]);

  const style: React.CSSProperties = {
    outline: isSelected ? '2px solid #4a90d9' : 'none',
    borderRadius: 4,
    padding: '4px 8px',
    margin: '4px 0',
    minHeight: '1.4em',
    cursor: 'text',
  };

  const commonProps = {
    ref: ref as React.RefObject<never>,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onInput: handleInput,
    onSelect: handleSelect,
    onFocus: handleFocus,
    style,
  };

  if (block.type === 'heading') {
    const level = block.level ?? 1;
    if (level === 1) return <h1 {...commonProps}>{block.text}</h1>;
    if (level === 2) return <h2 {...commonProps}>{block.text}</h2>;
    if (level === 3) return <h3 {...commonProps}>{block.text}</h3>;
    return <h4 {...commonProps}>{block.text}</h4>;
  }

  return <p {...commonProps}>{block.text}</p>;
};
