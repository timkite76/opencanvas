import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { OcdManifest } from './manifest.js';
import { assertSupportedFormatVersion } from './versioning.js';
import { FormatError } from './errors.js';
import * as paths from './paths.js';

export function deserializeArtifact(files: Record<string, string>): ArtifactEnvelope {
  const manifestRaw = files[paths.MANIFEST_PATH];
  if (!manifestRaw) {
    throw new FormatError('Missing manifest.json', paths.MANIFEST_PATH);
  }

  const manifest: OcdManifest = JSON.parse(manifestRaw);
  if (manifest.format !== 'ocd') {
    throw new FormatError(`Invalid format: "${manifest.format}"`, paths.MANIFEST_PATH);
  }
  assertSupportedFormatVersion(manifest.version);

  const artifactRaw = files[paths.ARTIFACT_PATH];
  if (!artifactRaw) {
    throw new FormatError('Missing artifact.json', paths.ARTIFACT_PATH);
  }
  const artifactEntry = JSON.parse(artifactRaw);

  const nodesRaw = files[paths.NODES_PATH];
  if (!nodesRaw) {
    throw new FormatError('Missing nodes/nodes.json', paths.NODES_PATH);
  }
  const nodes = JSON.parse(nodesRaw);

  const styles = parseOptionalJson(files[paths.STYLES_PATH], []);
  const themes = parseOptionalJson(files[paths.THEMES_PATH], []);
  const comments = parseOptionalJson(files[paths.COMMENTS_PATH], []);
  const agentLog = parseOptionalJson(files[paths.AGENT_LOG_PATH], []);
  const references = parseOptionalJson(files[paths.REFERENCES_PATH], []);
  const assets = parseOptionalJson(files[paths.ASSET_INDEX_PATH], []);
  const customProperties = parseOptionalJson(files[paths.CUSTOM_PROPERTIES_PATH], {});

  const artifact: ArtifactEnvelope = {
    ...artifactEntry,
    nodes,
    styles,
    themes,
    comments,
    agentLog,
    references,
    assets,
    customProperties,
  };

  return artifact;
}

function parseOptionalJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
