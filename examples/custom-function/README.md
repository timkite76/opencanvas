# Example: Custom AI Function

This example demonstrates how to build, register, and use a custom AI function in OpenCanvas.

## What This Example Does

The `summarize_document` function reads all text content from a document's node tree and produces a brief summary. It returns a `ReplaceTextOperation` that inserts the summary at the beginning of a target node. The user sees a preview of the summary and approves or rejects it before the operation is applied.

## Project Structure

```
examples/custom-function/
  package.json                        # Dependencies on function-sdk, core-types, core-model
  src/
    summarize-document.ts             # The RegisteredFunction implementation
```

## How to Use This Example

### Step 1: Build the Monorepo

From the repository root:

```bash
pnpm install
pnpm build
```

### Step 2: Register the Function

To use this function in the AI runtime, import and register it in `apps/ai-runtime/src/server.ts`:

```typescript
import { summarizeDocumentFunction } from '@opencanvas/example-custom-function';

registry.register(summarizeDocumentFunction);
```

Then rebuild:

```bash
pnpm build
```

### Step 3: Start the AI Runtime

```bash
pnpm --filter @opencanvas/ai-runtime dev
```

### Step 4: Verify Registration

```bash
curl http://localhost:4001/functions
```

You should see `summarize_document` in the list of registered functions.

### Step 5: Test the Function

Send a preview request to the AI runtime:

```bash
curl -X POST http://localhost:4001/ai/tasks/preview \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "summarize_document",
    "targetId": "node_p1",
    "parameters": { "maxSentences": 2 },
    "artifact": {
      "artifactId": "art_test",
      "title": "Test Document",
      "artifactType": "document",
      "version": { "major": 0, "minor": 1, "patch": 0 },
      "rootNodeId": "node_root",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "nodes": {
        "node_root": {
          "id": "node_root",
          "type": "document",
          "childIds": ["node_p1", "node_p2"]
        },
        "node_p1": {
          "id": "node_p1",
          "type": "paragraph",
          "parentId": "node_root",
          "metadata": { "text": "OpenCanvas is an AI-native office suite. It treats AI as a first-class participant." }
        },
        "node_p2": {
          "id": "node_p2",
          "type": "paragraph",
          "parentId": "node_root",
          "metadata": { "text": "Every AI action produces structured operations. Users preview and approve changes before they are applied." }
        }
      }
    }
  }'
```

The response includes the proposed operations and a preview of the summary text.

## Key Patterns Demonstrated

1. **Reading from the canonical model.** The function accesses `context.artifact.nodes` to extract text, showing how to traverse the node tree.

2. **Returning proposed operations.** Instead of mutating the model directly, the function returns a `ReplaceTextOperation` in the `proposedOperations` array.

3. **Permission declaration.** The function declares `scope: 'artifact'` (it reads the whole document), `mutatesArtifact: true` (it proposes changes), and `requiresApproval: true` (the user must approve).

4. **Input validation.** The function checks that the target node exists and that the document has text content before proceeding.

5. **Deterministic stub.** The summary logic is a simple sentence extractor. In production, you would replace this with an LLM call routed through `@opencanvas/model-router`.

## Next Steps

- Read the [AI Functions Guide](../../docs/ai-functions.md) for the full reference
- See `packages/function-examples/src/rewrite-block.ts` for another working function
- See `packages/grid-functions/` and `packages/deck-functions/` for domain-specific examples
