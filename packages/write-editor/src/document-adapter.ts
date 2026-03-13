import type { Operation, ObjectID } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { applyOperation, applyOperations } from '@opencanvas/core-ops';
import type { WriteNode, HeadingNode, ParagraphNode } from '@opencanvas/write-model';
import { getNodePlainText } from '@opencanvas/write-model';

export interface EditableBlock {
  id: ObjectID;
  type: 'heading' | 'paragraph';
  level?: number;
  text: string;
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
      blocks.push({
        id: node.id,
        type: 'heading',
        level: (node as HeadingNode).level,
        text: getNodePlainText(node),
      });
    } else if (node.type === 'paragraph') {
      blocks.push({
        id: node.id,
        type: 'paragraph',
        text: getNodePlainText(node),
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
