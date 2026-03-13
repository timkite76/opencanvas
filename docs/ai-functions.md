# AI Functions Guide

This guide explains how to build, register, and test AI functions in OpenCanvas. AI functions are the mechanism by which AI capabilities are exposed to users -- every AI action (rewriting text, generating formulas, creating slides) is a function.

## Core Concepts

### RegisteredFunction

Every AI function implements the `RegisteredFunction` interface from `@opencanvas/function-sdk`:

```typescript
interface RegisteredFunction {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: FunctionPermissionSpec;
  execute: (context: FunctionExecutionContext) => Promise<FunctionResult>;
}
```

| Field | Purpose |
|-------|---------|
| `name` | Unique identifier used to invoke the function (e.g., `rewrite_block`) |
| `description` | Human-readable explanation shown in the UI |
| `inputSchema` | JSON Schema describing the parameters the function accepts |
| `outputSchema` | JSON Schema describing the function's output |
| `permissions` | Declares what the function can access and whether it needs approval |
| `execute` | The function body -- receives context, returns proposed operations |

### FunctionExecutionContext

When the AI runtime invokes a function, it provides this context:

```typescript
interface FunctionExecutionContext {
  artifact: ArtifactEnvelope;       // The full canonical model
  targetId: ObjectID;                // The node the user selected
  selectionStart?: number;           // Optional text selection start offset
  selectionEnd?: number;             // Optional text selection end offset
  parameters: Record<string, unknown>; // User-provided parameters matching inputSchema
}
```

Key points:
- `artifact` is the complete in-memory model. You can read any node, traverse the tree, and inspect metadata.
- `targetId` identifies the specific node the user wants the function to act on.
- `parameters` are the values the user provided (e.g., which tone to rewrite in, what formula to generate).

### FunctionResult

Every function returns a `FunctionResult`:

```typescript
interface FunctionResult {
  proposedOperations: Operation[];   // Operations to apply if approved
  previewText?: string;              // Human-readable preview of the changes
  output?: Record<string, unknown>;  // Additional output data
}
```

The `proposedOperations` array contains standard `Operation` objects -- the same types used for human edits. The AI runtime holds these in a pending state until the user approves or rejects them.

### FunctionPermissionSpec

Permissions declare the function's scope and behavior:

```typescript
interface FunctionPermissionSpec {
  scope: ScopeSelector;
  mutatesArtifact: boolean;
  requiresApproval: boolean;
}

type ScopeSelector =
  | 'artifact'     // Function can read/modify the entire artifact
  | 'selection'    // Function operates on the current text selection
  | 'object'       // Function operates on a single node
  | 'range'        // Function operates on a range of nodes
  | 'slide'        // Function operates on a single slide (Deck)
  | 'section'      // Function operates on a document section (Write)
  | 'worksheet';   // Function operates on a single worksheet (Grid)
```

| Field | Description |
|-------|-------------|
| `scope` | What part of the artifact the function can access |
| `mutatesArtifact` | Whether the function proposes changes to the model |
| `requiresApproval` | Whether the user must approve before operations are applied. Set `true` for any destructive or significant change. |

## Building a Function: Step by Step

This walkthrough builds a function that summarizes the text content of a document.

### Step 1: Create the File

Create a new TypeScript file in the appropriate package. For this example, we will use `packages/function-examples/`:

```typescript
// packages/function-examples/src/summarize-document.ts

import { v4 as uuidv4 } from 'uuid';
import type { ReplaceTextOperation } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';
```

### Step 2: Implement the Logic

Read from the canonical model, compute your result, and return proposed operations:

```typescript
function extractAllText(context: FunctionExecutionContext): string {
  const texts: string[] = [];
  for (const node of Object.values(context.artifact.nodes)) {
    const meta = node.metadata as Record<string, unknown> | undefined;
    if (meta && typeof meta.text === 'string') {
      texts.push(meta.text);
    }
  }
  return texts.join('\n');
}
```

### Step 3: Define the RegisteredFunction

```typescript
export const summarizeDocumentFunction: RegisteredFunction = {
  name: 'summarize_document',
  description: 'Generate a brief summary of the entire document',
  inputSchema: {
    type: 'object',
    properties: {
      maxSentences: {
        type: 'number',
        description: 'Maximum number of sentences in the summary',
      },
    },
    required: [],
  },
  outputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
    },
  },
  permissions: {
    scope: 'artifact',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const fullText = extractAllText(context);
    if (!fullText) {
      throw new Error('Document has no text content to summarize');
    }

    // In production, this would call an LLM via model-router.
    // For now, we produce a deterministic summary.
    const sentences = fullText.split(/[.!?]+/).filter(Boolean);
    const maxSentences = (context.parameters.maxSentences as number) ?? 3;
    const summary = sentences.slice(0, maxSentences).join('. ').trim() + '.';

    const op: ReplaceTextOperation = {
      operationId: uuidv4(),
      type: 'replace_text',
      artifactId: context.artifact.artifactId,
      targetId: context.targetId,
      actorType: 'agent',
      actorId: 'summarizer-agent',
      timestamp: new Date().toISOString(),
      payload: {
        startOffset: 0,
        endOffset: 0,
        newText: `Summary: ${summary}`,
      },
    };

    return {
      proposedOperations: [op],
      previewText: summary,
      output: { summary },
    };
  },
};
```

### Step 4: Export from the Package

Add the export to the package's `index.ts`:

```typescript
// packages/function-examples/src/index.ts
export { rewriteBlockFunction } from './rewrite-block.js';
export { summarizeDocumentFunction } from './summarize-document.js';
```

### Step 5: Register in ai-runtime

Import and register the function in the AI runtime server:

```typescript
// apps/ai-runtime/src/server.ts
import { rewriteBlockFunction, summarizeDocumentFunction } from '@opencanvas/function-examples';

registry.register(rewriteBlockFunction);
registry.register(summarizeDocumentFunction);
```

### Step 6: Build and Verify

```bash
pnpm build
pnpm --filter @opencanvas/ai-runtime dev
```

Verify the function is registered:

```bash
curl http://localhost:4001/functions | jq '.functions[].name'
```

You should see `"summarize_document"` in the output.

## How Functions Get Registered

At startup, `ai-runtime` creates an `InMemoryFunctionRegistry` and calls `registry.register()` for each function:

```typescript
const registry = new InMemoryFunctionRegistry();
registry.register(rewriteBlockFunction);
registry.register(generateFormulaFunction);
// ... more functions
```

The registry is a simple `Map<string, RegisteredFunction>`. Functions are looked up by name when the client sends a request to `/ai/tasks/preview`.

## The Preview/Approve Pipeline

When a function is invoked via the AI runtime:

1. **Client** sends `POST /ai/tasks/preview` with `taskType` (function name), `targetId`, `parameters`, and the full `artifact`.
2. **ai-runtime** looks up the function in the registry and calls `execute()`.
3. The function returns `proposedOperations` and optional `previewText`.
4. **ai-runtime** stores the result as a `PendingTask` and returns it to the client.
5. **Client** displays the preview to the user.
6. **User approves**: Client sends `POST /ai/tasks/:taskId/approve`. The runtime returns the operations, and the client applies them via `applyOperation()`.
7. **User rejects**: Client sends `POST /ai/tasks/:taskId/reject`. The operations are discarded.

## Existing Functions

These functions ship with OpenCanvas:

| Function | Package | Description |
|----------|---------|-------------|
| `rewrite_block` | `function-examples` | Rewrite a block's text in a specified tone |
| `generate_formula` | `grid-functions` | Generate a spreadsheet formula from a description |
| `explain_formula` | `grid-functions` | Explain what a formula does in plain language |
| `create_deck_from_outline` | `deck-functions` | Generate a full slide deck from a text outline |
| `rewrite_slide` | `deck-functions` | Rewrite a slide's content |
| `generate_speaker_notes` | `deck-functions` | Generate speaker notes for a slide |

## Best Practices

1. **Keep functions focused.** One function should do one thing. Do not combine "rewrite" and "summarize" into a single function.

2. **Validate inputs early.** Check that `context.targetId` exists in `context.artifact.nodes` before doing any work. Throw a descriptive error if it does not.

3. **Return meaningful preview text.** The `previewText` field is shown to the user before they approve. Make it clear what will change.

4. **Use the correct operation types.** If you are replacing text, use `ReplaceTextOperation`. If you are adding a node, use `InsertNodeOperation`. Do not force everything through `update_node`.

5. **Set `requiresApproval: true` by default.** Only set it to `false` for read-only functions that do not mutate the artifact.

6. **Include `oldText` / `previousValue` in operation payloads.** This enables undo and makes the operation self-describing.

For a complete working example, see the [custom-function example](../examples/custom-function/).
