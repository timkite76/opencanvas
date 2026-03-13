import type { ReferenceID, ArtifactID, ObjectID } from './ids.js';

export type CrossArtifactRelationship =
  | 'linked_data'
  | 'embedded_chart'
  | 'outline_source'
  | 'appendix';

export interface CrossArtifactReference {
  referenceId: ReferenceID;
  sourceArtifactId: ArtifactID;
  sourceObjectId: ObjectID;
  targetArtifactId: ArtifactID;
  targetObjectId: ObjectID;
  relationship: CrossArtifactRelationship;
}
