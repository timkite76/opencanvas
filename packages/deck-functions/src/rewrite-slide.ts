import { v4 as uuidv4 } from 'uuid';
import type { ReplaceTextOperation, BaseNode } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

type AnyNode = Record<string, unknown>;

function getNodePlainText(node: AnyNode): string {
  const content = node.content;
  if (!content || !Array.isArray(content)) return '';
  return content
    .map((run: unknown) => {
      if (run && typeof run === 'object' && 'text' in run) {
        return (run as { text: string }).text;
      }
      return '';
    })
    .join('');
}

function rewriteText(original: string, tone: string): string {
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

export const rewriteSlideFunction: RegisteredFunction = {
  name: 'rewrite_slide',
  description: 'Rewrite all text box content on a given slide in a specified tone',
  inputSchema: {
    type: 'object',
    properties: {
      slideId: { type: 'string', description: 'The slide node ID to rewrite' },
      tone: {
        type: 'string',
        enum: ['executive', 'concise', 'friendly', 'formal'],
        description: 'The tone for the rewrite',
      },
    },
    required: ['slideId', 'tone'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      rewrittenCount: { type: 'number' },
    },
  },
  permissions: {
    scope: 'slide',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const slideId = (context.parameters.slideId as string) ?? context.targetId;
    const tone = context.parameters.tone as string;

    if (!tone) {
      throw new Error('Missing required parameter: tone');
    }

    const slideNode = context.artifact.nodes[slideId] as BaseNode | undefined;
    if (!slideNode) {
      throw new Error(`Slide "${slideId}" not found`);
    }

    const childIds = slideNode.childIds ?? [];
    const operations: ReplaceTextOperation[] = [];
    const previews: string[] = [];

    // Gather all textboxes first
    const textBoxes: Array<{ id: string; text: string }> = [];
    for (const childId of childIds) {
      const child = context.artifact.nodes[childId] as unknown as AnyNode | undefined;
      if (!child || child.type !== 'textbox') continue;
      const originalText = getNodePlainText(child);
      if (originalText) {
        textBoxes.push({ id: childId, text: originalText });
      }
    }

    if (textBoxes.length === 0) {
      throw new Error('No text boxes found on this slide to rewrite');
    }

    // Process each textbox
    for (const textBox of textBoxes) {
      let rewrittenText: string;

      if (context.callLlm) {
        // Real LLM call
        const systemPrompt = 'You are a presentation expert. Rewrite the slide text in the specified tone. Return ONLY the rewritten text for each text box, separated by ---';
        const userPrompt = `Rewrite this slide text in ${tone} tone:\n\n${textBox.text}`;
        rewrittenText = await context.callLlm({ systemPrompt, userPrompt });
        rewrittenText = rewrittenText.trim();
      } else {
        // Fallback to deterministic logic
        rewrittenText = rewriteText(textBox.text, tone);
      }

      operations.push({
        operationId: uuidv4(),
        type: 'replace_text',
        artifactId: context.artifact.artifactId,
        targetId: textBox.id,
        actorType: 'agent',
        actorId: 'deck-rewrite-agent',
        timestamp: new Date().toISOString(),
        payload: {
          startOffset: 0,
          endOffset: textBox.text.length,
          newText: rewrittenText,
          oldText: textBox.text,
        },
      });

      previews.push(`"${textBox.text.slice(0, 40)}..." -> "${rewrittenText.slice(0, 40)}..."`);
    }

    const previewText = `Rewrote ${operations.length} text box(es) in "${tone}" tone:\n${previews.join('\n')}`;

    return {
      proposedOperations: operations,
      previewText,
      output: { rewrittenCount: operations.length },
    };
  },
};
