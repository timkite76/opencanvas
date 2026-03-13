import { v4 as uuidv4 } from 'uuid';
import type {
  ArtifactID,
  ObjectID,
  MoveObjectOperation,
  ResizeObjectOperation,
  UpdateNodeOperation,
  DeleteNodeOperation,
} from '@opencanvas/core-types';

export function createMoveObjectOp(
  artifactId: ArtifactID,
  targetId: ObjectID,
  x: number,
  y: number,
  previousX?: number,
  previousY?: number,
): MoveObjectOperation {
  return {
    operationId: uuidv4(),
    type: 'move_object',
    artifactId,
    targetId,
    actorType: 'user',
    timestamp: new Date().toISOString(),
    payload: { x, y, previousX, previousY },
  };
}

export function createResizeObjectOp(
  artifactId: ArtifactID,
  targetId: ObjectID,
  width: number,
  height: number,
  previousWidth?: number,
  previousHeight?: number,
): ResizeObjectOperation {
  return {
    operationId: uuidv4(),
    type: 'resize_object',
    artifactId,
    targetId,
    actorType: 'user',
    timestamp: new Date().toISOString(),
    payload: { width, height, previousWidth, previousHeight },
  };
}

export function createUpdateNodeOp(
  artifactId: ArtifactID,
  targetId: ObjectID,
  patch: Record<string, unknown>,
): UpdateNodeOperation {
  return {
    operationId: uuidv4(),
    type: 'update_node',
    artifactId,
    targetId,
    actorType: 'user',
    timestamp: new Date().toISOString(),
    payload: { patch },
  };
}

export function createDeleteNodeOp(
  artifactId: ArtifactID,
  targetId: ObjectID,
): DeleteNodeOperation {
  return {
    operationId: uuidv4(),
    type: 'delete_node',
    artifactId,
    targetId,
    actorType: 'user',
    timestamp: new Date().toISOString(),
  };
}
