# Native File Formats

OpenCanvas defines three native file formats for its artifact types. Each format is a structured JSON package that preserves the full canonical model, including nodes, styles, themes, comments, agent action logs, and asset references.

## File Extensions

| Extension | Artifact Type | Full Name |
|-----------|---------------|-----------|
| `.ocd` | `document` | OpenCanvas Document |
| `.ocg` | `workbook` | OpenCanvas Grid |
| `.ocp` | `presentation` | OpenCanvas Presentation |

The mapping between artifact types and extensions is defined in `@opencanvas/core-format`:

```typescript
import { getExtensionForType, getTypeForExtension } from '@opencanvas/core-format';

getExtensionForType('document');    // '.ocd'
getExtensionForType('workbook');    // '.ocg'
getExtensionForType('presentation'); // '.ocp'

getTypeForExtension('.ocd'); // 'document'
getTypeForExtension('.ocg'); // 'workbook'
getTypeForExtension('.ocp'); // 'presentation'
```

## Package Layout

Each native file is a structured package with the following layout:

```
my-document.ocd/
  manifest.json                    # Package manifest
  artifact.json                    # Core artifact descriptor
  nodes/
    nodes.json                     # All nodes in the artifact tree
  styles/
    styles.json                    # Style definitions
  themes/
    themes.json                    # Theme definitions
  comments/
    comments.json                  # Comment threads
  agent/
    action-log.json                # AI agent action audit trail
  references/
    references.json                # Cross-artifact references
  assets/
    asset-index.json               # Asset manifest (references to embedded files)
  metadata/
    custom-properties.json         # Arbitrary user/plugin metadata
```

These paths are defined as constants in `@opencanvas/core-format`:

```typescript
import { formatPaths } from '@opencanvas/core-format';

formatPaths.MANIFEST_PATH;          // 'manifest.json'
formatPaths.ARTIFACT_PATH;          // 'artifact.json'
formatPaths.NODES_PATH;             // 'nodes/nodes.json'
formatPaths.STYLES_PATH;            // 'styles/styles.json'
formatPaths.THEMES_PATH;            // 'themes/themes.json'
formatPaths.COMMENTS_PATH;          // 'comments/comments.json'
formatPaths.AGENT_LOG_PATH;         // 'agent/action-log.json'
formatPaths.REFERENCES_PATH;        // 'references/references.json'
formatPaths.ASSET_INDEX_PATH;       // 'assets/asset-index.json'
formatPaths.CUSTOM_PROPERTIES_PATH; // 'metadata/custom-properties.json'
```

## manifest.json

The manifest is the entry point for the package. It declares the format, artifact type, version, and paths to all indexed files.

```json
{
  "format": "OpenCanvas",
  "artifactType": "document",
  "version": "0.1.0",
  "entry": "artifact.json",
  "nodeIndex": "nodes/nodes.json",
  "styleIndex": "styles/styles.json",
  "themeIndex": "themes/themes.json",
  "commentsIndex": "comments/comments.json",
  "agentLogIndex": "agent/action-log.json",
  "referencesIndex": "references/references.json",
  "assetIndex": "assets/asset-index.json",
  "customPropertiesIndex": "metadata/custom-properties.json"
}
```

The TypeScript interface:

```typescript
interface OpenCanvasManifest {
  format: 'OpenCanvas';
  artifactType: ArtifactType;   // 'document' | 'workbook' | 'presentation'
  version: string;               // Semantic version of the format
  entry: string;                 // Path to artifact.json
  nodeIndex: string;             // Path to nodes index
  styleIndex: string;            // Path to styles index
  themeIndex: string;            // Path to themes index
  commentsIndex: string;         // Path to comments index
  agentLogIndex: string;         // Path to agent action log
  referencesIndex: string;       // Path to cross-artifact references
  assetIndex: string;            // Path to asset index
  customPropertiesIndex: string; // Path to custom properties
}
```

## artifact.json

Contains the core artifact descriptor fields:

```json
{
  "artifactId": "art_abc123",
  "title": "Q1 Strategy Document",
  "artifactType": "document",
  "version": { "major": 0, "minor": 1, "patch": 0 },
  "rootNodeId": "node_root",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-03-12T14:22:00.000Z"
}
```

## nodes/nodes.json

A JSON object mapping node IDs to node objects. Each node conforms to `BaseNode` (or a domain-specific subtype like `WriteNode`, `GridNode`, or `DeckNode`):

```json
{
  "node_root": {
    "id": "node_root",
    "type": "document",
    "childIds": ["node_h1", "node_p1"],
    "metadata": {},
    "createdAt": "2026-01-15T10:30:00.000Z"
  },
  "node_h1": {
    "id": "node_h1",
    "type": "heading",
    "parentId": "node_root",
    "childIds": [],
    "metadata": { "level": 1 }
  },
  "node_p1": {
    "id": "node_p1",
    "type": "paragraph",
    "parentId": "node_root",
    "childIds": [],
    "metadata": {}
  }
}
```

## Serialization and Deserialization

Use `serializeArtifact` and `deserializeArtifact` from `@opencanvas/core-format`:

```typescript
import { serializeArtifact, deserializeArtifact } from '@opencanvas/core-format';
import type { ArtifactEnvelope } from '@opencanvas/core-model';

// Serialize an in-memory artifact to a package
const pkg: SerializedPackage = serializeArtifact(artifact);
// pkg contains the manifest and all indexed files as structured data

// Deserialize a package back to an in-memory artifact
const artifact: ArtifactEnvelope = deserializeArtifact(pkg);
```

## Versioning Strategy

The format version follows semantic versioning and is tracked by two constants in `@opencanvas/core-format`:

```typescript
const OPEN_CANVAS_FORMAT_NAME = 'OpenCanvas';
const CURRENT_FORMAT_VERSION = '0.1.0';
```

### Version Compatibility Rules

- **Patch version bump** (0.1.0 -> 0.1.1): Backward-compatible additions (new optional fields in nodes or metadata). Older readers can safely ignore unknown fields.
- **Minor version bump** (0.1.0 -> 0.2.0): New indexed sections or structural changes. Older readers may fail to load the full artifact but must not corrupt data.
- **Major version bump** (0.x -> 1.0): Breaking changes to the core structure. Migration tooling will be provided.

At startup, `assertSupportedFormatVersion` validates that a loaded package uses a compatible format version:

```typescript
import { assertSupportedFormatVersion } from '@opencanvas/core-format';

// Throws if version is unsupported
assertSupportedFormatVersion(manifest.version);
```

## Design Decisions

### Why a package instead of a single JSON file?

Splitting the artifact into multiple files within a package provides:

1. **Partial loading.** You can read `manifest.json` and `artifact.json` without loading all nodes, which is useful for file browsers and search indexers.
2. **Diffability.** When stored in version control, changes to comments do not create noise in the nodes file.
3. **Extensibility.** New sections (e.g., version history, plugin data) can be added as new files without changing existing paths.
4. **Asset management.** Binary assets (images, embedded files) live alongside the structured data in the `assets/` directory.

### Why JSON and not a binary format?

JSON is human-readable, diffable, and universally supported. For v1.0, we may add optional compression (e.g., gzip) for large artifacts, but the underlying structure will remain JSON.
