# Architecture

This document describes the layered architecture of OpenCanvas, the data flow for both human and AI edits, and the package dependency graph.

## Layers

OpenCanvas is organized into five layers. Each layer depends only on the layers below it.

```
+-----------------------------------------------------------------------+
|  Layer A: Client Applications                                         |
|  write-web, grid-web, deck-web                                        |
|  React apps that render the UI and handle user interaction             |
+-----------------------------------------------------------------------+
        |
+-----------------------------------------------------------------------+
|  Layer B: Editor Runtime                                              |
|  write-editor, grid-engine, deck-editor, deck-layout                  |
|  Adapters that bridge the canonical model to editor-specific UIs       |
|  Maintain selection state, editable block lists, rendering hints       |
+-----------------------------------------------------------------------+
        |
+-----------------------------------------------------------------------+
|  Layer C: Canonical Model & Operations                                |
|  core-types, core-model, core-ops, core-validation, core-history      |
|  core-permissions, core-comments, core-references, core-agent-log     |
|  The single source of truth for every artifact                        |
+-----------------------------------------------------------------------+
        |
+-----------------------------------------------------------------------+
|  Layer D: AI / Function Runtime                                       |
|  function-sdk, function-registry, model-router, prompt-registry       |
|  grounding-sdk, write-ai, grid-ai, deck-ai                           |
|  grid-functions, deck-functions, function-examples, plugin-sdk        |
|  ai-runtime (Express server hosting the function pipeline)            |
+-----------------------------------------------------------------------+
        |
+-----------------------------------------------------------------------+
|  Layer E: Storage & Interop                                           |
|  core-format, storage-sdk, collab-sdk                                 |
|  interop-ooxml, interop-docx, interop-xlsx, interop-pptx             |
|  Serialization to native formats, import/export, collaboration        |
+-----------------------------------------------------------------------+
```

## Layer A: Client Applications

Each application is a React single-page app built with Vite. Applications do not contain business logic beyond UI state management. They delegate all model mutations to Layer B adapters and Layer C operations.

| App | Port | Responsibility |
|-----|------|----------------|
| `write-web` | 3001 | Document editing UI, toolbar, AI panel |
| `grid-web` | 3002 | Spreadsheet editing UI, cell grid, formula bar |
| `deck-web` | 3004 | Presentation editing UI, slide navigator, speaker notes |

Applications communicate with the AI runtime (`ai-runtime` on port 4001) over HTTP to trigger AI functions and receive proposed operations.

## Layer B: Editor Runtime

Editor packages adapt the canonical `ArtifactEnvelope` into a shape that is convenient for rendering and interaction. For example, `write-editor` provides `WriteDocumentAdapter` which converts the canonical node tree into a flat list of `EditableBlock` objects that the React editor can render.

Editor packages are responsible for:
- Translating user gestures (keystrokes, clicks, drag) into `Operation` objects
- Maintaining selection state (`CanonicalSelection`)
- Providing read-only projections of the canonical model for rendering

Editor packages never mutate the `ArtifactEnvelope` directly. They produce `Operation` objects that are applied through `core-ops`.

## Layer C: Canonical Model & Operations

This is the heart of the system.

### ArtifactEnvelope

Every document, workbook, and presentation is represented as an `ArtifactEnvelope`:

```typescript
interface ArtifactEnvelope<TNode extends BaseNode = BaseNode> {
  // Identity
  artifactId: ArtifactID;
  title: string;
  artifactType: ArtifactType; // 'document' | 'workbook' | 'presentation'
  version: ArtifactVersion;   // { major, minor, patch }

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Node tree
  rootNodeId: ObjectID;
  nodes: Record<ObjectID, TNode>;

  // Auxiliary data
  assets?: AssetRef[];
  comments?: CommentThread[];
  agentLog?: AgentActionRecord[];
  permissions?: ArtifactPermissions;
  references?: CrossArtifactReference[];
  styles?: StyleRef[];
  themes?: ThemeRef[];
  customProperties?: Record<string, unknown>;
}
```

The `nodes` record is a flat map of node IDs to node objects. Each node has a `parentId` and `childIds`, forming a tree rooted at `rootNodeId`. This flat-map-with-parent-pointers design makes operations efficient while preserving tree semantics.

### Operations

Every mutation is an `Operation`. The operation types are:

| Type | Description |
|------|-------------|
| `insert_node` | Add a new node to the tree |
| `delete_node` | Remove a node from the tree |
| `update_node` | Patch a node's properties |
| `move_node` | Reparent a node |
| `insert_text` | Insert text at a position |
| `delete_text` | Delete text in a range |
| `replace_text` | Replace text in a range with new text |
| `set_style` | Apply a style to a node |
| `set_formula` | Set a cell's formula |
| `set_cell_value` | Set a cell's raw value |
| `resize_object` | Change an object's dimensions |
| `move_object` | Change an object's position |
| `apply_theme` | Apply a theme to an artifact |
| `create_chart` | Create a chart object |
| `delete_chart` | Remove a chart object |
| `batch` | Group multiple operations into one atomic unit |

Every operation carries:
- `operationId` -- unique identifier
- `type` -- the operation type
- `artifactId` -- which artifact this targets
- `targetId` -- which node this targets
- `actorType` -- `'user'`, `'agent'`, or `'system'`
- `actorId` -- optional identifier for the actor
- `timestamp` -- ISO 8601 timestamp

### applyOperation

`applyOperation` from `@opencanvas/core-ops` is the only way to mutate an `ArtifactEnvelope`:

1. Validates the operation via `@opencanvas/core-validation`
2. Deep-clones the artifact (operations are immutable)
3. Applies the type-specific mutation
4. Returns the new `ArtifactEnvelope`

The original artifact is never modified. This enables straightforward undo/redo by keeping a stack of previous artifact states.

## Layer D: AI / Function Runtime

### Function Model

Every AI capability is a `RegisteredFunction`:

```typescript
interface RegisteredFunction {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;   // JSON Schema
  outputSchema: Record<string, unknown>;  // JSON Schema
  permissions: FunctionPermissionSpec;
  execute: (context: FunctionExecutionContext) => Promise<FunctionResult>;
}
```

Functions receive the full `ArtifactEnvelope` as context and return `proposedOperations` -- the same `Operation` types used for human edits.

### Preview / Approve / Apply Pipeline

```
User action (e.g., "Rewrite in executive tone")
    |
    v
POST /ai/tasks/preview
    |
    v
ai-runtime looks up function in InMemoryFunctionRegistry
    |
    v
function.execute(context) returns FunctionResult
    |
    v
ai-runtime stores result as PendingTask, returns preview to client
    |
    v
Client shows preview diff to user
    |
    +---> User approves: POST /ai/tasks/:taskId/approve
    |         -> Returns approved operations
    |         -> Client applies via applyOperation()
    |
    +---> User rejects: POST /ai/tasks/:taskId/reject
              -> Operations discarded
```

### Audit Trail

Every AI action is recorded as an `AgentActionRecord`:

```typescript
interface AgentActionRecord {
  actionId: AgentActionID;
  agentName: AgentName;
  taskType: string;
  inputSummary: string;
  functionCalls: AgentFunctionCallRecord[];
  changedObjectIds: ObjectID[];
  operationIds: OperationID[];
  approvalState: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  groundingRefs?: string[];
  timestamp: string;
}
```

## Layer E: Storage & Interop

### Native Format (core-format)

`serializeArtifact` converts an `ArtifactEnvelope` into a structured package with a `manifest.json` and subdirectories. `deserializeArtifact` reverses the process. See [native-formats.md](native-formats.md) for the full specification.

### OOXML Interop

The `interop-docx`, `interop-xlsx`, and `interop-pptx` packages provide import/export between OpenCanvas artifacts and Microsoft Office formats. They share common OOXML utilities from `interop-ooxml`.

### Storage and Collaboration

`storage-sdk` abstracts file system and cloud storage. `collab-sdk` provides primitives for real-time collaboration (planned for v0.3).

## Data Flow Diagrams

### Human Edit Flow

```
User types "Hello" in write-web
    |
    v
WriteDocumentAdapter creates InsertTextOperation
    |
    v
applyOperation(currentArtifact, op) -> newArtifact
    |
    v
React state update -> re-render
    |
    v
History stack pushes newArtifact (enables undo)
```

### AI Edit Flow

```
User clicks "Rewrite" button in write-web
    |
    v
Client sends POST /ai/tasks/preview with artifact + targetId + parameters
    |
    v
ai-runtime calls rewriteBlockFunction.execute(context)
    |
    v
Function returns { proposedOperations: [ReplaceTextOperation], previewText }
    |
    v
ai-runtime stores PendingTask, logs AgentActionRecord
    |
    v
Client receives preview, shows diff to user
    |
    v
User clicks "Approve"
    |
    v
Client sends POST /ai/tasks/:taskId/approve
    |
    v
Client receives approved operations
    |
    v
applyOperation(currentArtifact, op) -> newArtifact
    |
    v
React state update -> re-render
```

## Package Dependency Graph

```
core-types  (leaf -- no internal dependencies)
    |
    +---> core-model
    |         |
    |         +---> core-validation
    |         |         |
    |         |         +---> core-ops
    |         |
    |         +---> core-format
    |         |
    |         +---> function-sdk
    |                   |
    |                   +---> function-registry
    |                   |
    |                   +---> function-examples
    |                   |
    |                   +---> grid-functions
    |                   |
    |                   +---> deck-functions
    |
    +---> write-model
    |         |
    |         +---> write-editor
    |                   |
    |                   +---> write-web
    |
    +---> grid-model
    |         |
    |         +---> grid-engine
    |                   |
    |                   +---> grid-web
    |
    +---> deck-model
              |
              +---> deck-editor
              |
              +---> deck-layout
                        |
                        +---> deck-web

ai-runtime depends on:
    function-registry, function-examples,
    grid-functions, deck-functions,
    core-types, core-model
```
