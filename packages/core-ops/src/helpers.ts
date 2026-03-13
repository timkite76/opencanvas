import type { BaseNode, ObjectID } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { OperationError } from './operation-errors.js';

export function cloneArtifact<T extends BaseNode = BaseNode>(
  artifact: ArtifactEnvelope<T>,
): ArtifactEnvelope<T> {
  return {
    ...artifact,
    nodes: Object.fromEntries(
      Object.entries(artifact.nodes).map(([k, v]) => [k, { ...v }]),
    ),
    version: { ...artifact.version },
  };
}

export function requireNode<T extends BaseNode = BaseNode>(
  artifact: ArtifactEnvelope<T>,
  nodeId: ObjectID,
): T {
  const node = artifact.nodes[nodeId];
  if (!node) {
    throw new OperationError(`Node "${nodeId}" not found in artifact`, undefined, { nodeId });
  }
  return node;
}

export function addChildToParent<T extends BaseNode = BaseNode>(
  artifact: ArtifactEnvelope<T>,
  parentId: ObjectID,
  childId: ObjectID,
  index?: number,
): void {
  const parent = requireNode(artifact, parentId);
  const childIds = parent.childIds ? [...parent.childIds] : [];
  if (index !== undefined && index >= 0 && index <= childIds.length) {
    childIds.splice(index, 0, childId);
  } else {
    childIds.push(childId);
  }
  artifact.nodes[parentId] = { ...parent, childIds };
}

export function removeChildFromParent<T extends BaseNode = BaseNode>(
  artifact: ArtifactEnvelope<T>,
  parentId: ObjectID,
  childId: ObjectID,
): void {
  const parent = requireNode(artifact, parentId);
  if (!parent.childIds) return;
  const childIds = parent.childIds.filter((id) => id !== childId);
  artifact.nodes[parentId] = { ...parent, childIds };
}
