import React, { useRef, useCallback, useState } from 'react';
import type { EditableBlock, CanonicalSelection, TextRun, InlineMark, SemanticBlockKind } from '@opencanvas/write-editor';

export interface FindMatch {
  blockId: string;
  startOffset: number;
  endOffset: number;
}

interface BlockEditorProps {
  block: EditableBlock;
  isSelected: boolean;
  onTextChange: (blockId: string, newText: string) => void;
  onSelectionChange: (selection: CanonicalSelection | null) => void;
  onFocus: (blockId: string) => void;
  onInsertBlockAfter: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onInsertListItemAfter?: (blockId: string, listType: 'bullet' | 'ordered') => void;
  onConvertToPararaph?: (blockId: string) => void;
  findMatches?: FindMatch[];
  currentMatchIndex?: number;
  allMatches?: FindMatch[];
  completionText?: string;
  onAcceptCompletion?: (blockId: string) => void;
  onDismissCompletion?: (blockId: string) => void;
}

/**
 * Renders a single TextRun with its inline marks applied as HTML elements.
 */
function renderTextRun(run: TextRun, index: number): React.ReactNode {
  const marks = run.marks ?? [];
  let node: React.ReactNode = run.text;

  // Wrap in mark elements from innermost to outermost
  if (marks.includes('code')) {
    node = <code key={`code-${index}`} style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.88em', color: '#d6336c' }}>{node}</code>;
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

/**
 * Renders text with find/replace highlights applied.
 * Splits the text into segments, wrapping matched portions in highlight spans.
 */
function renderHighlightedText(
  text: string,
  blockMatches: FindMatch[],
  currentMatchIndex: number,
  allMatches: FindMatch[],
): React.ReactNode {
  if (blockMatches.length === 0) {
    return text;
  }

  // Sort matches by startOffset
  const sorted = [...blockMatches].sort((a, b) => a.startOffset - b.startOffset);
  const segments: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const match of sorted) {
    // Add text before this match
    if (match.startOffset > lastEnd) {
      segments.push(text.slice(lastEnd, match.startOffset));
    }

    // Determine if this is the current active match
    const isCurrentMatch = allMatches[currentMatchIndex] !== undefined &&
      allMatches[currentMatchIndex].blockId === match.blockId &&
      allMatches[currentMatchIndex].startOffset === match.startOffset &&
      allMatches[currentMatchIndex].endOffset === match.endOffset;

    const highlightStyle: React.CSSProperties = isCurrentMatch
      ? { backgroundColor: '#ff9632', borderRadius: 2, padding: '0 1px' }
      : { backgroundColor: '#fff176', borderRadius: 2, padding: '0 1px' };

    segments.push(
      <span key={`hl-${match.startOffset}`} style={highlightStyle}>
        {text.slice(match.startOffset, match.endOffset)}
      </span>,
    );

    lastEnd = match.endOffset;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    segments.push(text.slice(lastEnd));
  }

  return <>{segments}</>;
}

/** Heading styles by level */
const HEADING_STYLES: Record<number, React.CSSProperties> = {
  1: { fontSize: 28, fontWeight: 700, lineHeight: 1.3, marginTop: 8, marginBottom: 4, letterSpacing: '-0.02em', color: '#111827' },
  2: { fontSize: 22, fontWeight: 700, lineHeight: 1.35, marginTop: 6, marginBottom: 3, letterSpacing: '-0.01em', color: '#1f2937' },
  3: { fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginTop: 4, marginBottom: 2, color: '#374151' },
  4: { fontSize: 16, fontWeight: 700, lineHeight: 1.5, marginTop: 2, marginBottom: 2, color: '#4b5563' },
};

const PARAGRAPH_STYLE: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.8,
  marginTop: 0,
  marginBottom: 0,
  color: '#1a1a1a',
};

const LIST_ITEM_STYLE: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.8,
  marginTop: 0,
  marginBottom: 0,
  color: '#1a1a1a',
  paddingLeft: 24,
  position: 'relative',
};

const LIST_MARKER_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: 24,
  textAlign: 'right',
  paddingRight: 8,
  userSelect: 'none',
  pointerEvents: 'none',
  color: '#6b7280',
};

/** Semantic block color configuration by kind */
const SEMANTIC_BLOCK_COLORS: Record<SemanticBlockKind, { bg: string; border: string }> = {
  requirement: { bg: '#e3f2fd', border: '#2196f3' },
  risk: { bg: '#fce4ec', border: '#f44336' },
  decision: { bg: '#e8f5e9', border: '#4caf50' },
  action_item: { bg: '#fff3e0', border: '#ff9800' },
  note: { bg: '#f5f5f5', border: '#9e9e9e' },
  callout: { bg: '#f3e5f5', border: '#9c27b0' },
};

const SEMANTIC_LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: 4,
  userSelect: 'none',
  pointerEvents: 'none',
};

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  isSelected,
  onTextChange,
  onSelectionChange,
  onFocus,
  onInsertBlockAfter,
  onDeleteBlock,
  onInsertListItemAfter,
  onConvertToPararaph,
  findMatches = [],
  currentMatchIndex = -1,
  allMatches = [],
  completionText,
  onAcceptCompletion,
  onDismissCompletion,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    // Exclude ghost text spans from the text content
    let newText = '';
    ref.current.childNodes.forEach((child) => {
      if (child instanceof HTMLElement && child.getAttribute('data-ghost-text') === 'true') {
        return; // skip ghost text
      }
      newText += child.textContent ?? '';
    });
    onTextChange(block.id, newText);
  }, [block.id, onTextChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Ghost text: Tab accepts, any other non-modifier key dismisses
      if (completionText) {
        if (e.key === 'Tab') {
          e.preventDefault();
          onAcceptCompletion?.(block.id);
          return;
        }
        // Modifier keys and navigation should not dismiss
        const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];
        if (!ignoredKeys.includes(e.key) && !isMod) {
          onDismissCompletion?.(block.id);
        }
      }

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

      // Enter: insert new block (or new list item)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (block.type === 'list_item' && block.listType) {
          const text = ref.current?.textContent ?? '';
          if (text.length === 0 && onConvertToPararaph) {
            // Empty list item: exit list by converting to paragraph
            onConvertToPararaph(block.id);
          } else if (onInsertListItemAfter) {
            onInsertListItemAfter(block.id, block.listType);
          } else {
            onInsertBlockAfter(block.id);
          }
        } else {
          onInsertBlockAfter(block.id);
        }
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
    [block.id, onInsertBlockAfter, onDeleteBlock, completionText, onAcceptCompletion, onDismissCompletion, onInsertListItemAfter, onConvertToPararaph],
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

  const baseStyle: React.CSSProperties = {
    borderRadius: 3,
    padding: '3px 6px',
    margin: '2px -6px',
    minHeight: '1.4em',
    cursor: 'text',
    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
    backgroundColor: isHovered && !isSelected ? '#fafbfc' : 'transparent',
    outline: 'none',
    boxShadow: isSelected ? 'inset 2px 0 0 #4a90d9' : 'none',
  };

  // Determine content: render runs with marks if any marks exist, otherwise plain text
  // If there are find matches for this block, render with highlights instead
  const hasHighlights = findMatches.length > 0;
  const useRichRuns = hasInlineMarks(block.runs);

  let content: React.ReactNode;
  if (hasHighlights) {
    // When highlighting search matches, use plain text with highlight spans
    content = renderHighlightedText(block.text, findMatches, currentMatchIndex, allMatches);
  } else if (useRichRuns) {
    content = block.runs.map((run, i) => renderTextRun(run, i));
  } else {
    content = block.text;
  }

  const commonProps = {
    ref: ref as React.RefObject<never>,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    onSelect: handleSelect,
    onFocus: handleFocus,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    'data-block-id': block.id,
  };

  if (block.type === 'heading') {
    const level = block.level ?? 1;
    const headingStyle = HEADING_STYLES[level] || HEADING_STYLES[4];
    const style = { ...baseStyle, ...headingStyle };
    if (level === 1) return <h1 {...commonProps} style={style}>{content}</h1>;
    if (level === 2) return <h2 {...commonProps} style={style}>{content}</h2>;
    if (level === 3) return <h3 {...commonProps} style={style}>{content}</h3>;
    return <h4 {...commonProps} style={style}>{content}</h4>;
  }

  if (block.type === 'list_item') {
    const marker = block.listType === 'ordered'
      ? `${(block.listIndex ?? 0) + 1}.`
      : '\u2022';
    return (
      <div style={{ ...baseStyle, ...LIST_ITEM_STYLE }} role="listitem">
        <span style={LIST_MARKER_STYLE} contentEditable={false} aria-hidden="true">
          {marker}
        </span>
        <div
          {...commonProps}
          style={{ minHeight: '1.4em', outline: 'none' }}
        >
          {content}
        </div>
      </div>
    );
  }

  if (block.type === 'semantic_block' && block.semanticKind) {
    const colors = SEMANTIC_BLOCK_COLORS[block.semanticKind] ?? SEMANTIC_BLOCK_COLORS.note;
    const label = block.semanticKind.replace('_', ' ').toUpperCase();

    const semanticWrapperStyle: React.CSSProperties = {
      borderLeft: `4px solid ${colors.border}`,
      backgroundColor: colors.bg,
      borderRadius: 4,
      padding: '8px 12px',
      margin: '6px 0',
    };

    const semanticContentStyle: React.CSSProperties = {
      ...PARAGRAPH_STYLE,
      minHeight: '1.4em',
      outline: 'none',
    };

    return (
      <div style={semanticWrapperStyle} data-semantic-kind={block.semanticKind}>
        <div
          style={{ ...SEMANTIC_LABEL_STYLE, color: colors.border }}
          contentEditable={false}
          aria-label={`${label} block`}
        >
          {label}
        </div>
        <div {...commonProps} style={semanticContentStyle}>
          {content}
        </div>
      </div>
    );
  }

  // Ghost text element for inline completions
  const ghostTextEl = completionText ? (
    <span
      contentEditable={false}
      style={{
        color: '#9ca3af',
        pointerEvents: 'none',
        userSelect: 'none',
        fontStyle: 'italic',
        opacity: 0.7,
      }}
      aria-label="Suggested completion (press Tab to accept)"
      data-ghost-text="true"
    >
      {completionText}
    </span>
  ) : null;

  return (
    <p {...commonProps} style={{ ...baseStyle, ...PARAGRAPH_STYLE }}>
      {content}
      {ghostTextEl}
    </p>
  );
};
