import type { ObjectID } from './ids.js';

export interface BaseNode {
  id: ObjectID;
  type: string;
  parentId?: ObjectID;
  childIds?: ObjectID[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}
