import type { BaseNode } from '@opencanvas/core-types';
import { ValidationError } from './errors.js';

export function validateNode(node: unknown): asserts node is BaseNode {
  if (!node || typeof node !== 'object') {
    throw new ValidationError('Node must be a non-null object');
  }

  const n = node as Record<string, unknown>;

  if (typeof n.id !== 'string' || n.id.length === 0) {
    throw new ValidationError('Node must have a non-empty string id', 'id');
  }

  if (typeof n.type !== 'string' || n.type.length === 0) {
    throw new ValidationError('Node must have a non-empty string type', 'type');
  }

  if (n.parentId !== undefined && typeof n.parentId !== 'string') {
    throw new ValidationError('Node parentId must be a string if present', 'parentId');
  }

  if (n.childIds !== undefined) {
    if (!Array.isArray(n.childIds)) {
      throw new ValidationError('Node childIds must be an array if present', 'childIds');
    }
    for (const childId of n.childIds) {
      if (typeof childId !== 'string') {
        throw new ValidationError('Each childId must be a string', 'childIds');
      }
    }
  }
}
