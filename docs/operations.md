# Operation System Reference

Operations are the single mutation mechanism in OpenCanvas. Every change to an artifact -- whether initiated by a human or an AI -- is expressed as an `Operation` object, validated, and applied immutably through `applyOperation`.

## Operation Types

All operations extend `BaseOperation`:

```typescript
interface BaseOperation {
  operationId: OperationID;   // Unique identifier
  type: OperationType;        // Discriminant
  artifactId: ArtifactID;     // Target artifact
  targetId: ObjectID;         // Target node
  actorType: ActorType;       // 'user' | 'agent' | 'system'
  actorId?: string;           // Optional actor identifier
  timestamp: string;          // ISO 8601
}
```

### insert_node

Add a new node to the artifact tree.

```typescript
interface InsertNodeOperation extends BaseOperation {
  type: 'insert_node';
  payload: {
    node: BaseNode;         // The node to insert
    parentId: ObjectID;     // Parent node ID
    index?: number;         // Position among siblings (appended if omitted)
  };
}
```

**Behavior:** Adds `node` to `artifact.nodes`, appends `node.id` to the parent's `childIds` at the specified index.

### delete_node

Remove a node from the artifact tree.

```typescript
interface DeleteNodeOperation extends BaseOperation {
  type: 'delete_node';
  // No payload -- targetId identifies the node to delete
}
```

**Behavior:** Removes the node from `artifact.nodes` and removes its ID from the parent's `childIds`. Child nodes are also removed recursively.

### update_node

Patch a node's properties.

```typescript
interface UpdateNodeOperation extends BaseOperation {
  type: 'update_node';
  payload: {
    patch: Record<string, unknown>;  // Partial update to merge
  };
}
```

**Behavior:** Shallow-merges `patch` into the target node. Does not affect `id`, `parentId`, or `childIds`.

### move_node

Reparent a node within the tree.

```typescript
interface MoveNodeOperation extends BaseOperation {
  type: 'move_node';
  payload: {
    newParentId: ObjectID;  // New parent node ID
    index?: number;         // Position among new siblings
  };
}
```

**Behavior:** Removes the node's ID from the old parent's `childIds`, adds it to the new parent's `childIds` at the specified index, and updates `node.parentId`.

### replace_text

Replace a range of text within a node.

```typescript
interface ReplaceTextOperation extends BaseOperation {
  type: 'replace_text';
  payload: {
    startOffset: number;    // Start of the range to replace
    endOffset: number;      // End of the range to replace
    newText: string;        // Replacement text
    oldText?: string;       // Previous text (for undo)
  };
}
```

**Behavior:** Replaces characters from `startOffset` to `endOffset` with `newText` in the target node's text content.

**To insert text:** Set `startOffset === endOffset` and provide `newText`.
**To delete text:** Set `newText` to an empty string.

### set_formula

Set a spreadsheet cell's formula.

```typescript
interface SetFormulaOperation extends BaseOperation {
  type: 'set_formula';
  payload: {
    formula: string;            // New formula (e.g., "=SUM(A1:A10)")
    previousFormula?: string;   // Previous formula (for undo)
  };
}
```

### set_cell_value

Set a spreadsheet cell's raw value.

```typescript
interface SetCellValueOperation extends BaseOperation {
  type: 'set_cell_value';
  payload: {
    rawValue: string | number | boolean | null;
    previousRawValue?: string | number | boolean | null;
  };
}
```

### move_object

Change an object's position (used in Deck for slide elements).

```typescript
interface MoveObjectOperation extends BaseOperation {
  type: 'move_object';
  payload: {
    x: number;
    y: number;
    previousX?: number;
    previousY?: number;
  };
}
```

### resize_object

Change an object's dimensions.

```typescript
interface ResizeObjectOperation extends BaseOperation {
  type: 'resize_object';
  payload: {
    width: number;
    height: number;
    previousWidth?: number;
    previousHeight?: number;
  };
}
```

### apply_theme

Apply a theme to an artifact.

```typescript
interface ApplyThemeOperation extends BaseOperation {
  type: 'apply_theme';
  payload: {
    themeId: string;
    previousThemeId?: string;
  };
}
```

### batch

Group multiple operations into one atomic unit.

```typescript
interface BatchOperation extends BaseOperation {
  type: 'batch';
  payload: {
    operations: Operation[];  // Child operations applied sequentially
  };
}
```

**Behavior:** Each child operation is applied in order. If any child operation fails validation, the entire batch fails and the artifact remains unchanged.

## How applyOperation Works

`applyOperation` from `@opencanvas/core-ops` is the entry point for all mutations:

```typescript
import { applyOperation, applyOperations } from '@opencanvas/core-ops';

// Apply a single operation
const newArtifact = applyOperation(currentArtifact, operation);

// Apply multiple operations in sequence
const newArtifact = applyOperations(currentArtifact, [op1, op2, op3]);
```

### Internal Steps

1. **Validate.** `validateOperation(op, artifact)` from `@opencanvas/core-validation` checks:
   - The operation has a valid `type`
   - The `targetId` exists in `artifact.nodes` (for operations that require it)
   - The payload matches the expected structure for the operation type
   - The actor has permission for this operation (via `core-permissions`)

2. **Clone.** The artifact is deep-cloned via `cloneArtifact()`. The original is never modified.

3. **Apply.** The type-specific mutation function is called on the clone:
   - `applyInsertNode` for `insert_node`
   - `applyDeleteNode` for `delete_node`
   - `applyUpdateNode` for `update_node`
   - `applyMoveNode` for `move_node`
   - `applyReplaceText` for `replace_text`
   - `applySetFormula` for `set_formula`
   - `applySetCellValue` for `set_cell_value`
   - `applyMoveObject` for `move_object`
   - `applyResizeObject` for `resize_object`
   - `applyApplyTheme` for `apply_theme`

4. **Update timestamp.** `cloned.updatedAt` is set to `op.timestamp`.

5. **Return.** The new `ArtifactEnvelope` is returned.

For `batch` operations, `applyOperation` is called recursively for each child operation.

### Error Handling

If validation or application fails, an `OperationError` is thrown:

```typescript
import { OperationError } from '@opencanvas/core-ops';

try {
  const newArtifact = applyOperation(artifact, op);
} catch (err) {
  if (err instanceof OperationError) {
    console.error('Operation failed:', err.message);
  }
}
```

## Validation Pipeline

`validateOperation` from `@opencanvas/core-validation` performs these checks:

1. **Structural validation.** The operation object has all required fields (`operationId`, `type`, `artifactId`, `targetId`, `actorType`, `timestamp`).
2. **Target existence.** For operations that target an existing node (`update_node`, `delete_node`, `replace_text`, etc.), the `targetId` must exist in `artifact.nodes`.
3. **Payload validation.** The operation's payload matches the expected structure. For example, `replace_text` requires `startOffset`, `endOffset`, and `newText`.
4. **Artifact validation.** `validateArtifactEnvelope` checks the overall integrity of the artifact (valid root node, no orphaned nodes, etc.).
5. **Node validation.** `validateNode` checks individual node integrity.

You can also validate artifacts and nodes directly:

```typescript
import { validateArtifactEnvelope, validateNode, ValidationError } from '@opencanvas/core-validation';

try {
  validateArtifactEnvelope(artifact);
} catch (err) {
  if (err instanceof ValidationError) {
    console.error('Invalid artifact:', err.message);
  }
}
```

## Inverse Operations for Undo

Operations that include "previous" values in their payloads support undo:

| Operation | Previous Value Field |
|-----------|---------------------|
| `replace_text` | `oldText` |
| `set_formula` | `previousFormula` |
| `set_cell_value` | `previousRawValue` |
| `move_object` | `previousX`, `previousY` |
| `resize_object` | `previousWidth`, `previousHeight` |
| `apply_theme` | `previousThemeId` |

To undo a `replace_text` operation, you construct a new `replace_text` operation that restores the `oldText`:

```typescript
const undoOp: ReplaceTextOperation = {
  operationId: uuidv4(),
  type: 'replace_text',
  artifactId: originalOp.artifactId,
  targetId: originalOp.targetId,
  actorType: 'system',
  timestamp: new Date().toISOString(),
  payload: {
    startOffset: originalOp.payload.startOffset,
    endOffset: originalOp.payload.startOffset + originalOp.payload.newText.length,
    newText: originalOp.payload.oldText ?? '',
    oldText: originalOp.payload.newText,
  },
};
```

The `core-history` package manages the undo/redo stack by keeping a sequence of artifact snapshots and the operations that produced them.

## Actor Types

Every operation records who initiated it:

| ActorType | Description |
|-----------|-------------|
| `user` | A human user made this edit |
| `agent` | An AI function produced this operation |
| `system` | An internal system process (e.g., auto-save, migration) |

This distinction enables audit trails, permission checks, and UI indicators (e.g., showing which changes were AI-generated).

## Creating Operations

When building operations programmatically (e.g., in AI functions or editor adapters), always:

1. Generate a unique `operationId` using `uuid`:
   ```typescript
   import { v4 as uuidv4 } from 'uuid';
   const operationId = uuidv4();
   ```

2. Set `actorType` correctly. AI functions use `'agent'`. Editor adapters use `'user'`.

3. Include previous values for undoability.

4. Use the current timestamp:
   ```typescript
   const timestamp = new Date().toISOString();
   ```

5. Reference the correct `artifactId` and `targetId` from the context.
