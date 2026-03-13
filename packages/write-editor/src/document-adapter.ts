import type { Operation, ObjectID } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { applyOperation, applyOperations } from '@opencanvas/core-ops';
import type { WriteNode, HeadingNode, ParagraphNode, ListNode, ListItemNode, SemanticBlockNode, SemanticBlockKind, TextRun, InlineMark } from '@opencanvas/write-model';
import { getNodePlainText } from '@opencanvas/write-model';

export type { TextRun, InlineMark, SemanticBlockKind };

export interface EditableBlock {
  id: ObjectID;
  type: 'heading' | 'paragraph' | 'list_item' | 'semantic_block';
  level?: number;
  text: string;
  runs: TextRun[];
  listType?: 'bullet' | 'ordered';
  listIndex?: number;
  semanticKind?: SemanticBlockKind;
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
    } else if (node.type === 'list') {
      // A list node itself is not editable; recurse into its list_item children
      const listNode = node as ListNode;
      if (node.childIds) {
        for (let i = 0; i < node.childIds.length; i++) {
          const childId = node.childIds[i];
          const childNode = this.artifact.nodes[childId] as WriteNode | undefined;
          if (childNode && childNode.type === 'list_item') {
            const listItemNode = childNode as ListItemNode;
            blocks.push({
              id: childNode.id,
              type: 'list_item',
              text: getNodePlainText(childNode),
              runs: listItemNode.content ?? [{ text: getNodePlainText(childNode) }],
              listType: listNode.listType,
              listIndex: i,
            });
          } else if (childNode) {
            this.collectBlocks(childId, blocks);
          }
        }
      }
      return; // Already handled children above
    } else if (node.type === 'semantic_block') {
      const semanticNode = node as SemanticBlockNode;
      blocks.push({
        id: node.id,
        type: 'semantic_block',
        text: getNodePlainText(node),
        runs: semanticNode.content ?? [{ text: getNodePlainText(node) }],
        semanticKind: semanticNode.kind,
      });
    } else if (node.type === 'list_item') {
      // A list_item without a list parent (orphan) — render as bullet by default
      const listItemNode = node as ListItemNode;
      blocks.push({
        id: node.id,
        type: 'list_item',
        text: getNodePlainText(node),
        runs: listItemNode.content ?? [{ text: getNodePlainText(node) }],
        listType: 'bullet',
        listIndex: 0,
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
