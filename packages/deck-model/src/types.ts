import type { BaseNode, ObjectID } from '@opencanvas/core-types';

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

export interface PresentationNode extends BaseNode {
  type: 'presentation';
  childIds: ObjectID[];
}

export interface SlideNode extends BaseNode {
  type: 'slide';
  childIds: ObjectID[];
  backgroundColor?: string;
  layoutId?: string;
}

export interface TextBoxNode extends BaseNode {
  type: 'textbox';
  x: number;
  y: number;
  width: number;
  height: number;
  content: TextRun[];
}

export interface ImageObjectNode extends BaseNode {
  type: 'image_object';
  x: number;
  y: number;
  width: number;
  height: number;
  assetId: string;
  alt?: string;
}

export type ShapeType = 'rectangle' | 'ellipse' | 'rounded_rect';

export interface ShapeNode extends BaseNode {
  type: 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  shapeType: ShapeType;
  fill?: string;
  stroke?: string;
}

export interface SpeakerNotesNode extends BaseNode {
  type: 'speaker_notes';
  content: TextRun[];
}

export type DeckNode =
  | PresentationNode
  | SlideNode
  | TextBoxNode
  | ImageObjectNode
  | ShapeNode
  | SpeakerNotesNode;

export function getDeckNodePlainText(node: DeckNode): string {
  if (!('content' in node) || !Array.isArray(node.content)) return '';
  return node.content.map((run: TextRun) => run.text).join('');
}
