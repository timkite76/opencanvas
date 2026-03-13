import type { ObjectID } from '@opencanvas/core-types';

export interface UserAwareness {
  userId: string;
  userName: string;
  color: string;
  cursor?: {
    objectId: ObjectID;
    offset: number;
  };
  selection?: {
    objectId: ObjectID;
    start: number;
    end: number;
  };
}

export type AwarenessState = Map<number, UserAwareness>;
