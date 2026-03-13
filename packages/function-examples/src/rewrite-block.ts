import { v4 as uuidv4 } from 'uuid';
import type { ReplaceTextOperation } from '@opencanvas/core-types';
import type { RegisteredFunction, FunctionExecutionContext, FunctionResult } from '@opencanvas/function-sdk';
import { getNodePlainText, type WriteNode } from '@opencanvas/write-model';

function rewriteText(original: string, tone: string, instructions?: string): string {
  // MVP: deterministic rewrite simulation
  // Will be replaced with real LLM call via model-router
  const toneMap: Record<string, (text: string) => string> = {
    executive: (t) =>
      `From a strategic perspective, ${t.charAt(0).toLowerCase()}${t.slice(1)}${t.endsWith('.') ? '' : '.'} This positions the organization for measurable impact.`,
    concise: (t) => {
      const sentences = t.split(/[.!?]+/).filter(Boolean);
      return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join('. ').trim() + '.';
    },
    friendly: (t) =>
      `Here's the thing — ${t.charAt(0).toLowerCase()}${t.slice(1)}${t.endsWith('.') ? '' : '.'} Pretty exciting, right?`,
    formal: (t) =>
      `It is hereby noted that ${t.charAt(0).toLowerCase()}${t.slice(1)}${t.endsWith('.') ? '' : '.'} This matter warrants further consideration.`,
  };

  const rewriter = toneMap[tone] ?? toneMap['executive']!;
  return rewriter(original);
}

export const rewriteBlockFunction: RegisteredFunction = {
  name: 'rewrite_block',
  description: 'Rewrite the text of a selected block in a specified tone',
  inputSchema: {
    type: 'object',
    properties: {
      tone: { type: 'string', enum: ['executive', 'concise', 'friendly', 'formal'] },
      instructions: { type: 'string' },
    },
    required: ['tone'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      rewrittenText: { type: 'string' },
    },
  },
  permissions: {
    scope: 'object',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const node = context.artifact.nodes[context.targetId] as WriteNode | undefined;
    if (!node) {
      throw new Error(`Node "${context.targetId}" not found`);
    }

    const originalText = getNodePlainText(node);
    if (!originalText) {
      throw new Error(`Node "${context.targetId}" has no text content`);
    }

    const tone = (context.parameters.tone as string) ?? 'executive';
    const instructions = context.parameters.instructions as string | undefined;

    let rewrittenText: string;

    if (context.callLlm) {
      // Real LLM call
      const systemPrompt = 'You are a professional editor. Rewrite the given text in the specified tone. Return ONLY the rewritten text, no explanations.';
      const userPrompt = `Rewrite the following text in ${tone} tone:\n\n${originalText}${instructions ? '\n\nAdditional instructions: ' + instructions : ''}`;
      rewrittenText = await context.callLlm({ systemPrompt, userPrompt });
      rewrittenText = rewrittenText.trim();
    } else {
      // Fallback to deterministic logic
      rewrittenText = rewriteText(originalText, tone, instructions);
    }

    const op: ReplaceTextOperation = {
      operationId: uuidv4(),
      type: 'replace_text',
      artifactId: context.artifact.artifactId,
      targetId: context.targetId,
      actorType: 'agent',
      actorId: 'writer-agent',
      timestamp: new Date().toISOString(),
      payload: {
        startOffset: 0,
        endOffset: originalText.length,
        newText: rewrittenText,
        oldText: originalText,
      },
    };

    return {
      proposedOperations: [op],
      previewText: rewrittenText,
      output: { rewrittenText },
    };
  },
};
