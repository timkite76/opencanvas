import type { ArtifactType } from '@opencanvas/core-types';
import * as paths from './paths.js';

export interface OcdManifest {
  format: 'ocd';
  artifactType: ArtifactType;
  version: string;
  entry: string;
  nodeIndex: string;
  styleIndex: string;
  themeIndex: string;
  commentsIndex: string;
  agentLogIndex: string;
  referencesIndex: string;
  assetIndex: string;
  customPropertiesIndex: string;
}

export function createManifest(artifactType: ArtifactType, version: string): OcdManifest {
  return {
    format: 'ocd',
    artifactType,
    version,
    entry: paths.ARTIFACT_PATH,
    nodeIndex: paths.NODES_PATH,
    styleIndex: paths.STYLES_PATH,
    themeIndex: paths.THEMES_PATH,
    commentsIndex: paths.COMMENTS_PATH,
    agentLogIndex: paths.AGENT_LOG_PATH,
    referencesIndex: paths.REFERENCES_PATH,
    assetIndex: paths.ASSET_INDEX_PATH,
    customPropertiesIndex: paths.CUSTOM_PROPERTIES_PATH,
  };
}
