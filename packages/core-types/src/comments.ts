import type { CommentID, ThreadID, ObjectID, UserID } from './ids.js';

export interface CommentAnchor {
  objectId: ObjectID;
  startOffset?: number;
  endOffset?: number;
}

export interface Comment {
  commentId: CommentID;
  authorId: UserID;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CommentThread {
  threadId: ThreadID;
  anchor: CommentAnchor;
  comments: Comment[];
  resolved: boolean;
  createdAt: string;
}
