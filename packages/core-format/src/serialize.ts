import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { OcdManifest } from './manifest.js';
import { createManifest } from './manifest.js';
import { CURRENT_FORMAT_VERSION } from './versioning.js';
import * as paths from './paths.js';

export interface SerializedPackage {
  manifest: OcdManifest;
  files: Record<string, string>;
}

export function serializeArtifact(artifact: ArtifactEnvelope): SerializedPackage {
  const manifest = createManifest(artifact.artifactType, CURRENT_FORMAT_VERSION);

  const artifactEntry = {
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    title: artifact.title,
    version: artifact.version,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    rootNodeId: artifact.rootNodeId,
  };

  const files: Record<string, string> = {
    [paths.MANIFEST_PATH]: JSON.stringify(manifest, null, 2),
    [paths.ARTIFACT_PATH]: JSON.stringify(artifactEntry, null, 2),
    [paths.NODES_PATH]: JSON.stringify(artifact.nodes, null, 2),
    [paths.STYLES_PATH]: JSON.stringify(artifact.styles ?? [], null, 2),
    [paths.THEMES_PATH]: JSON.stringify(artifact.themes ?? [], null, 2),
    [paths.COMMENTS_PATH]: JSON.stringify(artifact.comments ?? [], null, 2),
    [paths.AGENT_LOG_PATH]: JSON.stringify(artifact.agentLog ?? [], null, 2),
    [paths.REFERENCES_PATH]: JSON.stringify(artifact.references ?? [], null, 2),
    [paths.ASSET_INDEX_PATH]: JSON.stringify(artifact.assets ?? [], null, 2),
    [paths.CUSTOM_PROPERTIES_PATH]: JSON.stringify(artifact.customProperties ?? {}, null, 2),
  };

  return { manifest, files };
}
