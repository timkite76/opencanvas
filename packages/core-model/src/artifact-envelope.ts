import type {
  ArtifactType,
  ArtifactDescriptor,
  BaseNode,
  ObjectID,
  AssetRef,
  CommentThread,
  AgentActionRecord,
  CrossArtifactReference,
  StyleRef,
  ThemeRef,
} from '@opencanvas/core-types';

export interface ArtifactPermissions {
  owner?: string;
  editors?: string[];
  viewers?: string[];
  policies?: Record<string, unknown>;
}

export interface ArtifactEnvelope<TNode extends BaseNode = BaseNode> extends ArtifactDescriptor {
  artifactType: ArtifactType;
  rootNodeId: ObjectID;
  nodes: Record<ObjectID, TNode>;
  assets?: AssetRef[];
  comments?: CommentThread[];
  agentLog?: AgentActionRecord[];
  permissions?: ArtifactPermissions;
  references?: CrossArtifactReference[];
  styles?: StyleRef[];
  themes?: ThemeRef[];
  customProperties?: Record<string, unknown>;
}
