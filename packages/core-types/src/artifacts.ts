import type { ArtifactID } from './ids.js';

export type ArtifactType = 'document' | 'workbook' | 'presentation';
export type NativeFileExtension = '.ocd' | '.ocg' | '.ocp';

export interface ArtifactVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface ArtifactDescriptor {
  artifactId: ArtifactID;
  title: string;
  version: ArtifactVersion;
  createdAt: string;
  updatedAt: string;
}
