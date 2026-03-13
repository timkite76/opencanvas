import type { Operation, ObjectID } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { applyOperation, applyOperations } from '@opencanvas/core-ops';
import type { WriteNode, HeadingNode, ParagraphNode, TextRun, InlineMark } from '@opencanvas/write-model';
import { getNodePlainText } from '@opencanvas/write-model';

export type { TextRun, InlineMark };

export interface EditableBlock {
  id: ObjectID;
  type: 'heading' | 'paragraph';
  level?: number;
  text: string;
  runs: TextRun[];
}

export interface CanonicalSelection {
  objectId: ObjectID;
  startOffset: number;
  endOffset: number;
}

export class WriteDocumentAdapter {
  private artifact: ArtifactEnvelope;

  constructor(artifact: ArtifactEnvelope) {
    this.artifact = artifact;
  }

  getArtifact(): ArtifactEnvelope {
    return this.artifact;
  }

  getEditableBlocks(): EditableBlock[] {
    const rootNode = this.artifact.nodes[this.artifact.rootNodeId];
    if (!rootNode) return [];

    const blocks: EditableBlock[] = [];
    this.collectBlocks(rootNode.id, blocks);
    return blocks;
  }

  private collectBlocks(nodeId: ObjectID, blocks: EditableBlock[]): void {
    const node = this.artifact.nodes[nodeId] as WriteNode | undefined;
    if (!node) return;

    if (node.type === 'heading') {
      const headingNode = node as HeadingNode;
      blocks.push({
        id: node.id,
        type: 'heading',
        level: headingNode.level,
        text: getNodePlainText(node),
        runs: headingNode.content ?? [{ text: getNodePlainText(node) }],
      });
    } else if (node.type === 'paragraph') {
      const paragraphNode = node as ParagraphNode;
      blocks.push({
        id: node.id,
        type: 'paragraph',
        text: getNodePlainText(node),
        runs: paragraphNode.content ?? [{ text: getNodePlainText(node) }],
      });
    }

    if (node.childIds) {
      for (const childId of node.childIds) {
        this.collectBlocks(childId, blocks);
      }
    }
  }

  applyOperation(op: Operation): void {
    this.artifact = applyOperation(this.artifact, op);
  }

  applyOperations(ops: Operation[]): void {
    this.artifact = applyOperations(this.artifact, ops);
  }
}
