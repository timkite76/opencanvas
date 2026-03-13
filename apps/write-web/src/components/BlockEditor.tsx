import React, { useRef, useCallback } from 'react';
import type { EditableBlock, CanonicalSelection, TextRun, InlineMark } from '@opencanvas/write-editor';

interface BlockEditorProps {
  block: EditableBlock;
  isSelected: boolean;
  onTextChange: (blockId: string, newText: string) => void;
  onSelectionChange: (selection: CanonicalSelection | null) => void;
  onFocus: (blockId: string) => void;
  onInsertBlockAfter: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
}

/**
 * Renders a single TextRun with its inline marks applied as HTML elements.
 */
function renderTextRun(run: TextRun, index: number): React.ReactNode {
  const marks = run.marks ?? [];
  let node: React.ReactNode = run.text;

  // Wrap in mark elements from innermost to outermost
  if (marks.includes('code')) {
    node = <code key={`code-${index}`} style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 2, fontFamily: 'monospace', fontSize: '0.9em' }}>{node}</code>;
  }
  if (marks.includes('strikethrough')) {
    node = <s>{node}</s>;
  }
  if (marks.includes('underline')) {
    node = <u>{node}</u>;
  }
  if (marks.includes('italic')) {
    node = <em>{node}</em>;
  }
  if (marks.includes('bold')) {
    node = <strong>{node}</strong>;
  }

  return <React.Fragment key={index}>{node}</React.Fragment>;
}

/**
 * Checks if runs have any inline marks (used to decide between plain text and rich rendering).
 */
function hasInlineMarks(runs: TextRun[]): boolean {
  return runs.some((r) => r.marks && r.marks.length > 0);
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  isSelected,
  onTextChange,
  onSelectionChange,
  onFocus,
  onInsertBlockAfter,
  onDeleteBlock,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    const newText = ref.current.textContent ?? '';
    onTextChange(block.id, newText);
  }, [block.id, onTextChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Inline formatting shortcuts
      if (isMod && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false);
        return;
      }
      if (isMod && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false);
        return;
      }
      if (isMod && e.key === 'u') {
        e.preventDefault();
        document.execCommand('underline', false);
        return;
      }

      // Enter: insert new block
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onInsertBlockAfter(block.id);
        return;
      }

      // Backspace at start of empty block: delete block
      if (e.key === 'Backspace' && onDeleteBlock) {
        const el = ref.current;
        if (!el) return;
        const text = el.textContent ?? '';
        if (text.length === 0) {
          e.preventDefault();
          onDeleteBlock(block.id);
          return;
        }
        // Also handle backspace at cursor position 0
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (range.collapsed) {
            const preRange = document.createRange();
            preRange.selectNodeContents(el);
            preRange.setEnd(range.startContainer, range.startOffset);
            const offset = preRange.toString().length;
            if (offset === 0 && text.length === 0) {
              e.preventDefault();
              onDeleteBlock(block.id);
            }
          }
        }
      }
    },
    [block.id, onInsertBlockAfter, onDeleteBlock],
  );

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

  // Determine content: render runs with marks if any marks exist, otherwise plain text
  const useRichRuns = hasInlineMarks(block.runs);
  const content = useRichRuns
    ? block.runs.map((run, i) => renderTextRun(run, i))
    : block.text;

  const commonProps = {
    ref: ref as React.RefObject<never>,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    onSelect: handleSelect,
    onFocus: handleFocus,
    style,
    'data-block-id': block.id,
  };

  if (block.type === 'heading') {
    const level = block.level ?? 1;
    if (level === 1) return <h1 {...commonProps}>{content}</h1>;
    if (level === 2) return <h2 {...commonProps}>{content}</h2>;
    if (level === 3) return <h3 {...commonProps}>{content}</h3>;
    return <h4 {...commonProps}>{content}</h4>;
  }

  return <p {...commonProps}>{content}</p>;
};
