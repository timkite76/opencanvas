import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { ValidationError } from './errors.js';

export function validateOperation(op: Operation, artifact: ArtifactEnvelope): void {
  if (!op.operationId || typeof op.operationId !== 'string') {
    throw new ValidationError('Operation must have an operationId', 'operationId');
  }

  if (!op.type || typeof op.type !== 'string') {
    throw new ValidationError('Operation must have a type', 'type');
  }

  if (op.artifactId !== artifact.artifactId) {
    throw new ValidationError(
      `Operation artifactId "${op.artifactId}" does not match artifact "${artifact.artifactId}"`,
      'artifactId',
    );
  }

  if (op.type === 'delete_node' && op.targetId === artifact.rootNodeId) {
    throw new ValidationError('Cannot delete the root node', 'targetId');
  }

  if (op.type === 'batch') {
    for (const childOp of op.payload.operations) {
      validateOperation(childOp, artifact);
    }
    return;
  }

  if (op.type === 'insert_node') {
    if (op.payload.parentId && !(op.payload.parentId in artifact.nodes)) {
      throw new ValidationError(
        `Insert target parent "${op.payload.parentId}" not found`,
        'targetId',
      );
    }
    return;
  }

  if (op.targetId && !(op.targetId in artifact.nodes)) {
    throw new ValidationError(
      `Operation target node "${op.targetId}" not found in artifact`,
      'targetId',
    );
  }
}
