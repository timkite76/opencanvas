# Contributing to OpenCanvas

Thank you for your interest in contributing to OpenCanvas. This guide covers everything you need to get started: environment setup, coding standards, architecture rules, and the PR process.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Coding Standards](#coding-standards)
- [Architecture Rules](#architecture-rules)
- [How to Add a New AI Function](#how-to-add-a-new-ai-function)
- [How to Add a New Editor Package](#how-to-add-a-new-editor-package)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting Guidelines](#issue-reporting-guidelines)

## Development Environment Setup

### Prerequisites

- **Node.js** 20.0.0 or later
- **pnpm** 9.15.0 or later
- **Git**

### Initial Setup

1. Fork and clone the repository:

```bash
git clone https://github.com/timkite76/opencanvas.git
cd opencanvas
```

2. Install dependencies:

```bash
pnpm install
```

3. Build all packages (required before running any app, since packages depend on each other):

```bash
pnpm build
```

4. Run type checking to verify everything compiles:

```bash
pnpm typecheck
```

5. Start the development servers:

```bash
# Terminal 1: AI runtime
pnpm --filter @opencanvas/ai-runtime dev

# Terminal 2: Write editor
pnpm --filter @opencanvas/write-web dev

# Terminal 3: Grid editor
pnpm --filter @opencanvas/grid-web dev

# Terminal 4: Deck editor
pnpm --filter @opencanvas/deck-web dev
```

### Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages (topologically ordered via Turborepo) |
| `pnpm dev` | Start all apps in dev mode |
| `pnpm typecheck` | Run TypeScript type checking across all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests across all packages |
| `pnpm clean` | Remove all `dist/` output directories |
| `pnpm --filter <pkg> dev` | Run a single package in dev mode |

### Working on a Single Package

Turborepo handles dependency ordering. If you are working on `core-ops`, its dependents (`core-types`, `core-model`, `core-validation`) must be built first. The simplest approach:

```bash
pnpm build
# Now work on your package
pnpm --filter @opencanvas/core-ops dev
```

## Coding Standards

### TypeScript

- **Strict mode is mandatory.** Every package uses `"strict": true` in its `tsconfig.json`.
- **Type all function signatures.** Do not rely on implicit `any`. Use explicit return types on exported functions.
- **Prefer interfaces over type aliases** for object shapes that may be extended.
- **Use branded types for IDs.** The codebase uses string-based ID types (`ArtifactID`, `ObjectID`, `OperationID`, etc.) defined in `core-types`. Use them instead of raw `string`.

### Code Style

- **Prettier** is configured at the repo root. Run `pnpm prettier --write .` before committing, or configure your editor to format on save.
- **No default exports.** Use named exports exclusively.
- **Imports use `.js` extensions** for ESM compatibility (e.g., `import { foo } from './bar.js'`).

### Operation-Based Mutations

This is the single most important rule in the codebase:

- **Never mutate an `ArtifactEnvelope` directly.** All changes to the canonical model must go through `applyOperation` from `@opencanvas/core-ops`.
- **Every change is an `Operation`.** Whether a human types a character or an AI rewrites a paragraph, it becomes an `Operation` with a type, target ID, actor, and payload.
- **Operations are immutable and validated.** `applyOperation` clones the artifact, validates the operation via `core-validation`, and returns a new `ArtifactEnvelope`. The original is untouched.

### Naming Conventions

- **Packages:** `@opencanvas/<domain>-<layer>` (e.g., `@opencanvas/write-model`, `@opencanvas/core-ops`)
- **Files:** kebab-case (`apply-operation.ts`, `artifact-envelope.ts`)
- **Types/Interfaces:** PascalCase (`ArtifactEnvelope`, `RegisteredFunction`)
- **Functions:** camelCase (`applyOperation`, `validateNode`)
- **Constants:** UPPER_SNAKE_CASE (`CURRENT_FORMAT_VERSION`, `MANIFEST_PATH`)

## Architecture Rules

These rules are non-negotiable. They preserve the integrity of the system.

### 1. The Canonical Model is Truth

`ArtifactEnvelope` (from `@opencanvas/core-model`) is the single source of truth for every document, workbook, and presentation. Editor components render from it. Serialization reads from it. AI functions receive it as context.

### 2. AI Never Mutates Directly

AI functions return `proposedOperations` -- an array of `Operation` objects. These operations are shown to the user as a preview. Only after the user approves (or the function is marked `auto_approved`) are the operations applied to the canonical model. The flow is:

```
User triggers AI action
    -> ai-runtime calls function.execute()
    -> Function returns FunctionResult { proposedOperations, previewText }
    -> Client shows preview diff
    -> User approves or rejects
    -> If approved: operations applied via applyOperation()
```

### 3. Operations are the Only Mutation Path

Both human edits and AI edits produce `Operation` objects. Both pass through `applyOperation`. There is no separate "AI writes directly to model" path. This guarantees:

- Every change is validated
- Every change is recorded in history (undo/redo)
- Every change is auditable (agent log for AI, operation log for humans)

### 4. Packages Have Clear Dependency Direction

```
core-types       (no internal deps)
    |
core-model       (depends on core-types)
    |
core-validation  (depends on core-types, core-model)
    |
core-ops         (depends on core-types, core-model, core-validation)
    |
function-sdk     (depends on core-types, core-model)
    |
write-model / grid-model / deck-model  (depend on core-types)
    |
write-editor / grid-engine / deck-editor (depend on their model + core-ops)
    |
write-web / grid-web / deck-web (depend on editors + ui packages)
```

Do not introduce circular dependencies. Do not have `core-types` depend on `core-model`. Do not have a model package depend on an editor package.

### 5. Each Package Has a Single Responsibility

- `core-types` defines types. It does not contain logic.
- `core-ops` applies operations. It does not validate or serialize.
- `core-format` serializes/deserializes. It does not apply operations.

If you find yourself importing half the monorepo into one package, you are probably violating this rule.

## How to Add a New AI Function

AI functions implement the `RegisteredFunction` interface from `@opencanvas/function-sdk`. Here is a step-by-step walkthrough.

### Step 1: Create the Function File

Add your function to an appropriate package. For Write functions, use `packages/write-ai/` or `packages/function-examples/`. For Grid or Deck, use `packages/grid-functions/` or `packages/deck-functions/`.

```typescript
// packages/function-examples/src/my-function.ts
import { v4 as uuidv4 } from 'uuid';
import type { ReplaceTextOperation } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';
```

### Step 2: Define the Function Object

```typescript
export const myFunction: RegisteredFunction = {
  name: 'my_function',
  description: 'A clear description of what this function does',
  inputSchema: {
    type: 'object',
    properties: {
      // JSON Schema for your function's parameters
      option: { type: 'string', enum: ['a', 'b', 'c'] },
    },
    required: ['option'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'string' },
    },
  },
  permissions: {
    scope: 'object',         // 'artifact' | 'selection' | 'object' | 'range' | 'slide' | 'section' | 'worksheet'
    mutatesArtifact: true,   // Does this function change the document?
    requiresApproval: true,  // Must the user approve before apply?
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    // 1. Read from context.artifact (the canonical model)
    // 2. Read context.targetId, context.parameters
    // 3. Compute your result
    // 4. Return proposed operations

    return {
      proposedOperations: [/* your Operation objects */],
      previewText: 'Human-readable preview of what will change',
      output: { result: 'any additional output data' },
    };
  },
};
```

### Step 3: Export from the Package Index

```typescript
// packages/function-examples/src/index.ts
export { myFunction } from './my-function.js';
```

### Step 4: Register in ai-runtime

```typescript
// apps/ai-runtime/src/server.ts
import { myFunction } from '@opencanvas/function-examples';

registry.register(myFunction);
```

### Step 5: Rebuild and Test

```bash
pnpm build
pnpm --filter @opencanvas/ai-runtime dev
# Verify your function appears at http://localhost:4001/functions
```

For a complete working example, see [examples/custom-function/](examples/custom-function/).

## How to Add a New Editor Package

If you are adding support for a new artifact type (e.g., a diagramming editor):

1. **Define the model** in `packages/<name>-model/` -- your domain-specific node types extending `BaseNode`.
2. **Create the editor** in `packages/<name>-editor/` -- the adapter that bridges the canonical model to your UI.
3. **Create the web app** in `apps/<name>-web/` -- the React application.
4. **Add AI functions** in `packages/<name>-functions/` if your editor has AI capabilities.
5. **Define the file extension** by adding it to `NativeFileExtension` in `core-types` and to the mapping in `core-format/src/file-types.ts`.
6. **Update `pnpm-workspace.yaml`** -- the `apps/*` and `packages/*` globs should pick up your new directories automatically.

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes.** Follow the coding standards and architecture rules above.

3. **Verify your changes build and type-check:**
   ```bash
   pnpm build
   pnpm typecheck
   ```

4. **Run tests:**
   ```bash
   pnpm test
   ```

5. **Open a pull request** against `main` with:
   - A clear title describing the change
   - A description explaining **what** changed and **why**
   - Screenshots or recordings for UI changes
   - References to related issues

6. **Address review feedback.** All PRs require at least one approving review.

### PR Checklist

- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] No circular dependencies introduced
- [ ] All mutations go through `applyOperation`
- [ ] AI functions return `proposedOperations`, never mutate directly
- [ ] New exports are added to the appropriate package `index.ts`
- [ ] Types are explicit -- no implicit `any`

## Issue Reporting Guidelines

### Bug Reports

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node.js version, browser)
- Console errors or stack traces

### Feature Requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Include:

- The problem you are trying to solve
- Your proposed solution
- Alternatives you considered
- Whether you are willing to implement it

### Questions

Open a discussion instead of an issue. Issues are for actionable bugs and feature requests.
