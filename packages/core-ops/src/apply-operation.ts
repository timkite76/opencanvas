import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { validateOperation } from '@opencanvas/core-validation';
import { cloneArtifact } from './helpers.js';
import { OperationError } from './operation-errors.js';
import {
  applyInsertNode,
  applyDeleteNode,
  applyUpdateNode,
  applyMoveNode,
  applyReplaceText,
  applySetFormula,
  applySetCellValue,
  applyMoveObject,
  applyResizeObject,
  applyApplyTheme,
} from './artifact-mutations.js';

export function applyOperation(
  artifact: ArtifactEnvelope,
  op: Operation,
): ArtifactEnvelope {
  validateOperation(op, artifact);

  const cloned = cloneArtifact(artifact);
  cloned.updatedAt = op.timestamp;

  switch (op.type) {
    case 'insert_node':
      applyInsertNode(cloned, op);
      break;
    case 'delete_node':
      applyDeleteNode(cloned, op);
      break;
    case 'update_node':
      applyUpdateNode(cloned, op);
      break;
    case 'move_node':
      applyMoveNode(cloned, op);
      break;
    case 'replace_text':
      applyReplaceText(cloned, op);
      break;
    case 'set_formula':
      applySetFormula(cloned, op);
      break;
    case 'set_cell_value':
      applySetCellValue(cloned, op);
      break;
    case 'move_object':
      applyMoveObject(cloned, op);
      break;
    case 'resize_object':
      applyResizeObject(cloned, op);
      break;
    case 'apply_theme':
      applyApplyTheme(cloned, op);
      break;
    case 'batch':
      return applyBatch(artifact, op);
    default:
      throw new OperationError(`Unsupported operation type: ${(op as Operation).type}`);
  }

  return cloned;
}

function applyBatch(
  artifact: ArtifactEnvelope,
  op: Extract<Operation, { type: 'batch' }>,
): ArtifactEnvelope {
  let current = artifact;
  for (const childOp of op.payload.operations) {
    current = applyOperation(current, childOp);
  }
  return current;
}

export function applyOperations(
  artifact: ArtifactEnvelope,
  ops: Operation[],
): ArtifactEnvelope {
  let current = artifact;
  for (const op of ops) {
    current = applyOperation(current, op);
  }
  return current;
}
