import { v4 as uuidv4 } from 'uuid';
import type {
  ArtifactID,
  ObjectID,
  BaseNode,
  InsertNodeOperation,
  DeleteNodeOperation,
  MoveNodeOperation,
} from '@opencanvas/core-types';

export function createInsertSlideOp(
  artifactId: ArtifactID,
  presentationId: ObjectID,
  slideNode: BaseNode,
  index?: number,
): InsertNodeOperation {
  return {
    operationId: uuidv4(),
    type: 'insert_node',
    artifactId,
    targetId: slideNode.id,
    actorType: 'user',
    timestamp: new Date().toISOString(),
    payload: {
      node: slideNode,
      parentId: presentationId,
      index,
    },
  };
}

export function createDeleteSlideOp(
  artifactId: ArtifactID,
  slideId: ObjectID,
): DeleteNodeOperation {
  return {
    operationId: uuidv4(),
    type: 'delete_node',
    artifactId,
    targetId: slideId,
    actorType: 'user',
    timestamp: new Date().toISOString(),
  };
}

export function createReorderSlideOp(
  artifactId: ArtifactID,
  slideId: ObjectID,
  newParentId: ObjectID,
  newIndex: number,
): MoveNodeOperation {
  return {
    operationId: uuidv4(),
    type: 'move_node',
    artifactId,
    targetId: slideId,
    actorType: 'user',
    timestamp: new Date().toISOString(),
    payload: {
      newParentId,
      index: newIndex,
    },
  };
}

export function createInsertNodeOp(
  artifactId: ArtifactID,
  parentId: ObjectID,
  node: BaseNode,
  index?: number,
): InsertNodeOperation {
  return {
    operationId: uuidv4(),
    type: 'insert_node',
    artifactId,
    targetId: node.id,
    actorType: 'user',
    timestamp: new Date().toISOString(),
    payload: {
      node,
      parentId,
      index,
    },
  };
}
