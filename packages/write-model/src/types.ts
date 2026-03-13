import type { BaseNode, ObjectID } from '@opencanvas/core-types';

export type InlineMark = 'bold' | 'italic' | 'underline' | 'code' | 'strikethrough';

export interface TextRun {
  text: string;
  marks?: InlineMark[];
}

export interface DocumentNode extends BaseNode {
  type: 'document';
}

export interface SectionNode extends BaseNode {
  type: 'section';
  title?: string;
}

export interface HeadingNode extends BaseNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: TextRun[];
}

export interface ParagraphNode extends BaseNode {
  type: 'paragraph';
  content: TextRun[];
}

export interface ListNode extends BaseNode {
  type: 'list';
  listType: 'bullet' | 'ordered';
}

export interface ListItemNode extends BaseNode {
  type: 'list_item';
  content: TextRun[];
}

export interface TableNode extends BaseNode {
  type: 'table';
  columns: number;
  rows: number;
}

export interface TableRowNode extends BaseNode {
  type: 'table_row';
}

export interface TableCellNode extends BaseNode {
  type: 'table_cell';
  content: TextRun[];
}

export interface ImageNode extends BaseNode {
  type: 'image';
  assetId: string;
  alt?: string;
  width?: number;
  height?: number;
}

export type SemanticBlockKind =
  | 'requirement'
  | 'risk'
  | 'decision'
  | 'action_item'
  | 'note'
  | 'callout';

export interface SemanticBlockNode extends BaseNode {
  type: 'semantic_block';
  kind: SemanticBlockKind;
  content: TextRun[];
}

export type WriteNode =
  | DocumentNode
  | SectionNode
  | HeadingNode
  | ParagraphNode
  | ListNode
  | ListItemNode
  | TableNode
  | TableRowNode
  | TableCellNode
  | ImageNode
  | SemanticBlockNode;

export function isWriteNode(node: BaseNode): node is WriteNode {
  return [
    'document',
    'section',
    'heading',
    'paragraph',
    'list',
    'list_item',
    'table',
    'table_row',
    'table_cell',
    'image',
    'semantic_block',
  ].includes(node.type);
}

export function getNodePlainText(node: WriteNode): string {
  if ('content' in node && Array.isArray(node.content)) {
    return node.content.map((run: TextRun) => run.text).join('');
  }
  return '';
}
