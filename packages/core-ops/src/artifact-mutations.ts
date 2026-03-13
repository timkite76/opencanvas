import type {
  InsertNodeOperation,
  DeleteNodeOperation,
  UpdateNodeOperation,
  MoveNodeOperation,
  ReplaceTextOperation,
  SetFormulaOperation,
  SetCellValueOperation,
  MoveObjectOperation,
  ResizeObjectOperation,
  ApplyThemeOperation,
} from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { requireNode, addChildToParent, removeChildFromParent } from './helpers.js';
import { OperationError } from './operation-errors.js';

// Nodes in the envelope are typed as BaseNode, but concrete nodes carry extra
// fields (content, formula, rawValue, x, y, width, height). We use a loose
// record type for in-place mutation so TS doesn't reject unknown properties.
type AnyNode = Record<string, unknown>;

function nodeRef(artifact: ArtifactEnvelope, id: string): AnyNode {
  return artifact.nodes[id] as unknown as AnyNode;
}

function setNode(artifact: ArtifactEnvelope, id: string, node: AnyNode): void {
  (artifact.nodes as Record<string, unknown>)[id] = node;
}

export function applyInsertNode(
  artifact: ArtifactEnvelope,
  op: InsertNodeOperation,
): void {
  const { node, parentId, index } = op.payload;
  if (artifact.nodes[node.id]) {
    throw new OperationError(`Node "${node.id}" already exists`, 'insert_node');
  }
  setNode(artifact, node.id, { ...node, parentId } as unknown as AnyNode);
  addChildToParent(artifact, parentId, node.id, index);
}

export function applyDeleteNode(
  artifact: ArtifactEnvelope,
  op: DeleteNodeOperation,
): void {
  const node = requireNode(artifact, op.targetId);
  if (node.parentId) {
    removeChildFromParent(artifact, node.parentId, op.targetId);
  }
  delete artifact.nodes[op.targetId];
}

export function applyUpdateNode(
  artifact: ArtifactEnvelope,
  op: UpdateNodeOperation,
): void {
  const node = requireNode(artifact, op.targetId);
  setNode(artifact, op.targetId, {
    ...(node as unknown as AnyNode),
    ...op.payload.patch,
    id: node.id,
    type: node.type,
  });
}

export function applyMoveNode(
  artifact: ArtifactEnvelope,
  op: MoveNodeOperation,
): void {
  const node = requireNode(artifact, op.targetId);
  if (node.parentId) {
    removeChildFromParent(artifact, node.parentId, op.targetId);
  }
  addChildToParent(artifact, op.payload.newParentId, op.targetId, op.payload.index);
  setNode(artifact, op.targetId, {
    ...(node as unknown as AnyNode),
    parentId: op.payload.newParentId,
  });
}

export function applyReplaceText(
  artifact: ArtifactEnvelope,
  op: ReplaceTextOperation,
): void {
  const node = nodeRef(artifact, op.targetId);
  if (!node) throw new OperationError(`Node "${op.targetId}" not found`, 'replace_text');

  const { startOffset, endOffset, newText } = op.payload;
  const currentText = getNodePlainText(node);
  const before = currentText.slice(0, startOffset);
  const after = currentText.slice(endOffset);
  const updated = before + newText + after;

  setNode(artifact, op.targetId, {
    ...node,
    content: [{ text: updated }],
  });
}

export function applySetFormula(
  artifact: ArtifactEnvelope,
  op: SetFormulaOperation,
): void {
  const node = nodeRef(artifact, op.targetId);
  if (!node) throw new OperationError(`Node "${op.targetId}" not found`, 'set_formula');
  setNode(artifact, op.targetId, { ...node, formula: op.payload.formula });
}

export function applySetCellValue(
  artifact: ArtifactEnvelope,
  op: SetCellValueOperation,
): void {
  const node = nodeRef(artifact, op.targetId);
  if (!node) throw new OperationError(`Node "${op.targetId}" not found`, 'set_cell_value');
  setNode(artifact, op.targetId, { ...node, rawValue: op.payload.rawValue });
}

export function applyMoveObject(
  artifact: ArtifactEnvelope,
  op: MoveObjectOperation,
): void {
  const node = nodeRef(artifact, op.targetId);
  if (!node) throw new OperationError(`Node "${op.targetId}" not found`, 'move_object');
  setNode(artifact, op.targetId, { ...node, x: op.payload.x, y: op.payload.y });
}

export function applyResizeObject(
  artifact: ArtifactEnvelope,
  op: ResizeObjectOperation,
): void {
  const node = nodeRef(artifact, op.targetId);
  if (!node) throw new OperationError(`Node "${op.targetId}" not found`, 'resize_object');
  setNode(artifact, op.targetId, { ...node, width: op.payload.width, height: op.payload.height });
}

export function applyApplyTheme(
  artifact: ArtifactEnvelope,
  op: ApplyThemeOperation,
): void {
  artifact.customProperties = {
    ...artifact.customProperties,
    activeThemeId: op.payload.themeId,
  };
}

function getNodePlainText(node: AnyNode): string {
  const content = node.content;
  if (!content || !Array.isArray(content)) return '';
  return content
    .map((run: unknown) => {
      if (run && typeof run === 'object' && 'text' in run) {
        return (run as { text: string }).text;
      }
      return '';
    })
    .join('');
}
