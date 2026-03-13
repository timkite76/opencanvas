# OpenCanvas

> An open-source, AI-native office suite with document, spreadsheet, and presentation editors built on a shared canonical model.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/timkite76/opencanvas)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)

## Why This Exists

Traditional office suites bolt AI on as an afterthought -- a chatbot sidebar that generates text you then copy-paste into your document. OpenCanvas treats AI as a first-class participant in the editing process. Every AI action produces structured operations that go through a preview-approve-apply pipeline, the same operation system that handles human edits. The result: AI can rewrite paragraphs, generate formulas, and build slide decks while you stay in full control of what actually changes.

## Architecture

```
+-----------------------------------------------------------+
|                     Client Applications                    |
|  write-web (:3001)   grid-web (:3002)   deck-web (:3004)  |
+-----------------------------------------------------------+
        |                    |                    |
+-----------------------------------------------------------+
|                    Editor Packages                         |
|  write-editor         grid-engine         deck-editor      |
|  write-model          grid-model          deck-model       |
+-----------------------------------------------------------+
        |                    |                    |
+-----------------------------------------------------------+
|                    Core Packages                           |
|  core-types    core-model    core-ops    core-validation   |
|  core-format   core-history  core-permissions              |
+-----------------------------------------------------------+
        |                    |                    |
+-----------------------------------------------------------+
|                    AI / Function Layer                      |
|  function-sdk     function-registry     model-router       |
|  prompt-registry  grounding-sdk         write-ai           |
|  grid-ai          deck-ai              function-examples   |
+-----------------------------------------------------------+
        |                    |
+-----------------------------------------------------------+
|                  Storage & Interop                          |
|  storage-sdk   interop-docx   interop-xlsx   interop-pptx  |
|  collab-sdk    core-format    interop-ooxml                |
+-----------------------------------------------------------+
```

## Features

### Write (Documents)
- Block-based rich text editor with a canonical document model
- AI-powered rewriting with tone control (executive, concise, friendly, formal)
- Operation-based editing with full undo/redo history
- Native `.ocd` file format with structured serialization

### Grid (Spreadsheets)
- Cell-based workbook editor with formula support
- AI formula generation and explanation
- Set-cell-value and set-formula operations
- Native `.ocg` file format

### Deck (Presentations)
- Slide-based presentation editor with layout engine
- AI-powered deck generation from outlines
- Slide rewriting and speaker notes generation
- Native `.ocp` file format

## Quick Start

**Prerequisites:** Node.js 20+, pnpm 9+

```bash
git clone https://github.com/timkite76/opencanvas.git
cd opencanvas
pnpm install
pnpm build
```

Start the AI runtime and editors in separate terminals:

```bash
# Terminal 1: AI runtime (port 4001)
pnpm --filter @opencanvas/ai-runtime dev

# Terminal 2: Write editor (port 3001)
pnpm --filter @opencanvas/write-web dev

# Terminal 3: Grid editor (port 3002)
pnpm --filter @opencanvas/grid-web dev

# Terminal 4: Deck editor (port 3004)
pnpm --filter @opencanvas/deck-web dev
```

Open your browser to `http://localhost:3001` to start writing.

## Monorepo Structure

This is a pnpm + Turborepo monorepo. All packages use TypeScript in strict mode.

### Applications (`apps/`)

| App | Package | Description |
|-----|---------|-------------|
| `write-web` | `@opencanvas/write-web` | React-based document editor |
| `grid-web` | `@opencanvas/grid-web` | React-based spreadsheet editor |
| `deck-web` | `@opencanvas/deck-web` | React-based presentation editor |
| `ai-runtime` | `@opencanvas/ai-runtime` | Express server hosting the AI function registry and preview/approve pipeline |

### Core Packages (`packages/`)

| Package | Description |
|---------|-------------|
| `core-types` | Shared TypeScript types: operations, nodes, artifacts, IDs |
| `core-model` | `ArtifactEnvelope` -- the canonical in-memory model for all artifact types |
| `core-ops` | `applyOperation` / `applyOperations` -- immutable operation application |
| `core-validation` | Operation and artifact validation before mutations |
| `core-format` | Serialization/deserialization for native file formats |
| `core-history` | Undo/redo stack management |
| `core-permissions` | Permission checking for operations and AI actions |
| `core-comments` | Comment thread types and utilities |
| `core-references` | Cross-artifact reference resolution |
| `core-agent-log` | Agent action audit trail |

### Editor Packages (`packages/`)

| Package | Description |
|---------|-------------|
| `write-model` | Document-specific node types (`WriteNode`) and text utilities |
| `write-editor` | `WriteDocumentAdapter` -- bridges canonical model to editable blocks |
| `write-ai` | Write-specific AI prompt templates and utilities |
| `grid-model` | Spreadsheet-specific node types (`GridNode`) |
| `grid-engine` | Formula evaluation and cell dependency graph |
| `grid-ai` | Grid-specific AI utilities |
| `grid-functions` | AI functions for spreadsheets (generate formula, explain formula) |
| `deck-model` | Presentation-specific node types (`DeckNode`) |
| `deck-editor` | Slide editing adapter |
| `deck-layout` | Slide layout engine |
| `deck-ai` | Deck-specific AI utilities |
| `deck-functions` | AI functions for presentations (create deck, rewrite slide, speaker notes) |

### AI & Function Packages (`packages/`)

| Package | Description |
|---------|-------------|
| `function-sdk` | `RegisteredFunction` interface, `FunctionExecutionContext`, `FunctionResult` |
| `function-registry` | `InMemoryFunctionRegistry` -- stores and retrieves registered functions |
| `function-examples` | Example functions (e.g., `rewrite_block`) |
| `model-router` | Routes AI requests to LLM providers |
| `prompt-registry` | Manages prompt templates |
| `grounding-sdk` | Grounding and citation utilities for AI outputs |
| `plugin-sdk` | Extension point for third-party plugins |

### UI Packages (`packages/`)

| Package | Description |
|---------|-------------|
| `ui-design-system` | Shared component library |
| `ui-editor-shell` | Common editor chrome (toolbar, sidebar layout) |
| `ui-ai-panel` | AI interaction panel component |
| `ui-change-preview` | Diff/preview component for proposed AI changes |

### Storage & Interop (`packages/`)

| Package | Description |
|---------|-------------|
| `storage-sdk` | File system and cloud storage abstraction |
| `collab-sdk` | Real-time collaboration primitives |
| `interop-ooxml` | Shared OOXML utilities |
| `interop-docx` | Import/export for `.docx` files |
| `interop-xlsx` | Import/export for `.xlsx` files |
| `interop-pptx` | Import/export for `.pptx` files |

## Native File Formats

OpenCanvas defines three native file formats, each a structured JSON package:

| Extension | Artifact Type | Description |
|-----------|---------------|-------------|
| `.ocd` | Document | OpenCanvas Document |
| `.ocg` | Workbook | OpenCanvas Grid (spreadsheet) |
| `.ocp` | Presentation | OpenCanvas Presentation |

Each file is a package containing a `manifest.json` and structured subdirectories for nodes, styles, themes, comments, agent logs, references, and assets. See [docs/native-formats.md](docs/native-formats.md) for the full specification.

## AI-Native Architecture

OpenCanvas treats AI as a structured participant, not a text-generation black box. Here is how it works:

1. **Functions, not prompts.** Every AI capability is a `RegisteredFunction` with a declared name, input/output schema, and permission spec. Functions are registered in the `InMemoryFunctionRegistry` at startup.

2. **Preview before apply.** When a user triggers an AI action, the runtime calls the function's `execute` method, which returns `proposedOperations` -- the same `Operation` types used for human edits. The client shows a preview diff. Nothing changes until the user approves.

3. **Operations are the single source of mutation.** Both human edits and AI edits flow through `applyOperation`. The canonical `ArtifactEnvelope` is never mutated directly. Every operation is validated by `core-validation` before application.

4. **Full audit trail.** Every AI action is recorded as an `AgentActionRecord` with the function called, inputs, outputs, changed object IDs, and approval state (`pending`, `approved`, `rejected`, `auto_approved`).

See [docs/ai-functions.md](docs/ai-functions.md) for a guide to building your own AI functions.

## Current Status

OpenCanvas is at **MVP (v0.1.0)**. The core operation pipeline, canonical model, and AI preview/approve flow are functional across all three editors. The native file format serialization is implemented. Editor UIs are functional but minimal.

### Roadmap

- **v0.2** -- Real LLM integration via `model-router` (replacing deterministic stubs)
- **v0.3** -- Real-time collaboration via `collab-sdk` (CRDT-based)
- **v0.4** -- OOXML import/export (`.docx`, `.xlsx`, `.pptx`)
- **v0.5** -- Plugin system via `plugin-sdk` for third-party extensions
- **v0.6** -- Cloud storage and workspace management
- **v1.0** -- Production-ready release with stable API surface

## Documentation

- [Architecture](docs/architecture.md) -- Detailed system architecture and data flow
- [Native File Formats](docs/native-formats.md) -- File format specification
- [AI Functions Guide](docs/ai-functions.md) -- How to build AI functions
- [Operation System](docs/operations.md) -- Operation types and mutation pipeline
- [Contributing](CONTRIBUTING.md) -- How to contribute to OpenCanvas

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding standards, architecture rules, and the PR process.

## License

MIT -- see [LICENSE](LICENSE) for details.
