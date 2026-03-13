import type { BaseNode } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { ValidationError } from './errors.js';
import { validateNode } from './validate-node.js';

export function validateArtifactEnvelope(artifact: unknown): asserts artifact is ArtifactEnvelope {
  if (!artifact || typeof artifact !== 'object') {
    throw new ValidationError('Artifact must be a non-null object');
  }

  const a = artifact as Record<string, unknown>;

  if (typeof a.artifactId !== 'string' || a.artifactId.length === 0) {
    throw new ValidationError('Artifact must have a non-empty artifactId', 'artifactId');
  }

  const validTypes = ['document', 'workbook', 'presentation'];
  if (!validTypes.includes(a.artifactType as string)) {
    throw new ValidationError(
      `artifactType must be one of: ${validTypes.join(', ')}`,
      'artifactType',
    );
  }

  if (typeof a.title !== 'string') {
    throw new ValidationError('Artifact must have a title string', 'title');
  }

  if (!a.version || typeof a.version !== 'object') {
    throw new ValidationError('Artifact must have a version object', 'version');
  }

  if (typeof a.rootNodeId !== 'string' || a.rootNodeId.length === 0) {
    throw new ValidationError('Artifact must have a non-empty rootNodeId', 'rootNodeId');
  }

  if (!a.nodes || typeof a.nodes !== 'object' || Array.isArray(a.nodes)) {
    throw new ValidationError('Artifact must have a nodes map', 'nodes');
  }

  const nodes = a.nodes as Record<string, unknown>;

  if (!(a.rootNodeId as string in nodes)) {
    throw new ValidationError('rootNodeId must exist in nodes map', 'rootNodeId');
  }

  for (const [key, node] of Object.entries(nodes)) {
    validateNode(node);
    const typedNode = node as BaseNode;
    if (typedNode.id !== key) {
      throw new ValidationError(`Node map key "${key}" must match node id "${typedNode.id}"`, 'nodes');
    }

    if (typedNode.parentId && !(typedNode.parentId in nodes)) {
      throw new ValidationError(
        `Node "${typedNode.id}" references non-existent parent "${typedNode.parentId}"`,
        'nodes',
      );
    }

    if (typedNode.childIds) {
      for (const childId of typedNode.childIds) {
        if (!(childId in nodes)) {
          throw new ValidationError(
            `Node "${typedNode.id}" references non-existent child "${childId}"`,
            'nodes',
          );
        }
      }
    }
  }
}
