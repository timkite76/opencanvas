import { v4 as uuidv4 } from 'uuid';
import type { ReplaceTextOperation, BaseNode } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

/**
 * Extract all text content from an artifact's nodes.
 *
 * Walks every node in the artifact and collects text from nodes
 * that have a `text` field in their metadata.
 */
function extractAllText(nodes: Record<string, BaseNode>): string {
  const texts: string[] = [];
  for (const node of Object.values(nodes)) {
    const meta = node.metadata as Record<string, unknown> | undefined;
    if (meta && typeof meta.text === 'string' && meta.text.length > 0) {
      texts.push(meta.text);
    }
  }
  return texts.join(' ');
}

/**
 * Produce a summary by extracting the first N sentences.
 *
 * In a production implementation, you would replace this with an LLM call
 * routed through @opencanvas/model-router. This deterministic version
 * demonstrates the function contract without requiring an API key.
 */
function summarize(text: string, maxSentences: number): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  if (sentences.length === 0) {
    return text.slice(0, 200).trim();
  }

  const selected = sentences.slice(0, maxSentences);
  const summary = selected.join(' ').trim();

  // Ensure summary ends with punctuation
  if (!/[.!?]$/.test(summary)) {
    return summary + '.';
  }
  return summary;
}

/**
 * summarize_document -- an example RegisteredFunction.
 *
 * This function reads all text content from a document and produces a
 * brief summary. It returns a ReplaceTextOperation that inserts the
 * summary at the beginning of the target node.
 *
 * Usage:
 *   1. Register this function in the ai-runtime's InMemoryFunctionRegistry.
 *   2. Call POST /ai/tasks/preview with taskType "summarize_document".
 *   3. The client receives a preview with the proposed summary text.
 *   4. The user approves or rejects.
 */
export const summarizeDocumentFunction: RegisteredFunction = {
  name: 'summarize_document',
  description: 'Generate a brief summary of the entire document and insert it at the target node',

  inputSchema: {
    type: 'object',
    properties: {
      maxSentences: {
        type: 'number',
        description: 'Maximum number of sentences in the summary (default: 3)',
      },
    },
    required: [],
  },

  outputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      sourceNodeCount: { type: 'number' },
    },
  },

  permissions: {
    scope: 'artifact',
    mutatesArtifact: true,
    requiresApproval: true,
  },

  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    // Validate that the target node exists
    const targetNode = context.artifact.nodes[context.targetId];
    if (!targetNode) {
      throw new Error(`Target node "${context.targetId}" not found in artifact`);
    }

    // Extract all text from the document
    const fullText = extractAllText(context.artifact.nodes);
    if (!fullText || fullText.trim().length === 0) {
      throw new Error('Document has no text content to summarize');
    }

    // Determine max sentences from parameters
    const maxSentences = (context.parameters.maxSentences as number) ?? 3;
    if (maxSentences < 1) {
      throw new Error('maxSentences must be at least 1');
    }

    // Generate the summary
    const summary = summarize(fullText, maxSentences);

    // Build the proposed operation.
    // This inserts the summary at the beginning of the target node's text.
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
        newText: `Summary: ${summary}\n\n`,
      },
    };

    // Count how many nodes contributed text
    const allNodes = Object.values(context.artifact.nodes) as BaseNode[];
    const sourceNodeCount = allNodes.filter((n) => {
      const meta = n.metadata as Record<string, unknown> | undefined;
      return meta && typeof meta.text === 'string' && meta.text.length > 0;
    }).length;

    return {
      proposedOperations: [op],
      previewText: summary,
      output: { summary, sourceNodeCount },
    };
  },
};
