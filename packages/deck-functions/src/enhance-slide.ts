import { v4 as uuidv4 } from 'uuid';
import type { InsertNodeOperation, UpdateNodeOperation, BaseNode } from '@opencanvas/core-types';
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

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractKeyPoints(text: string): string[] {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  // Take first word-cluster from each sentence as a key point
  return sentences.map((sentence) => {
    const words = sentence.split(/\s+/);
    if (words.length <= 6) return sentence;
    return words.slice(0, 6).join(' ') + '...';
  });
}

function deriveBodyFromTitle(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  // Generate bullet points based on the title content
  const bullets: string[] = [];

  if (words.length >= 2) {
    bullets.push(`Overview of ${title.toLowerCase()}`);
    bullets.push(`Key aspects of ${words.slice(0, 3).join(' ').toLowerCase()}`);
    bullets.push(`Impact and implications`);
    bullets.push(`Next steps and action items`);
  } else {
    bullets.push(`Definition and overview`);
    bullets.push(`Key details`);
    bullets.push(`Summary and takeaways`);
  }

  return bullets.map((b) => `\u2022 ${b}`).join('\n');
}

export const enhanceSlideFunction: RegisteredFunction = {
  name: 'enhance_slide',
  description: 'Enhance a slide by adding body text from titles, simplifying text-heavy slides, and adding decorative elements',
  inputSchema: {
    type: 'object',
    properties: {
      slideId: { type: 'string', description: 'The slide node ID to enhance' },
    },
    required: ['slideId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      enhancementType: { type: 'string' },
      operationCount: { type: 'number' },
    },
  },
  permissions: {
    scope: 'slide',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const slideId = (context.parameters.slideId as string) ?? context.targetId;

    const slideNode = context.artifact.nodes[slideId] as BaseNode | undefined;
    if (!slideNode) {
      throw new Error(`Slide "${slideId}" not found`);
    }

    const childIds = slideNode.childIds ?? [];
    const textBoxes: Array<{ id: string; node: AnyNode; text: string }> = [];

    for (const childId of childIds) {
      const child = context.artifact.nodes[childId] as unknown as AnyNode | undefined;
      if (!child || child.type !== 'textbox') continue;
      const text = getNodePlainText(child);
      textBoxes.push({ id: childId, node: child, text });
    }

    if (textBoxes.length === 0) {
      throw new Error('No text boxes found on this slide to enhance');
    }

    const operations: Array<InsertNodeOperation | UpdateNodeOperation> = [];
    const timestamp = new Date().toISOString();
    const artifactId = context.artifact.artifactId;
    let enhancementType = '';
    const previews: string[] = [];

    const totalWords = textBoxes.reduce((sum, tb) => sum + countWords(tb.text), 0);

    // Case 1: Title-only slide (just one box with a short title) - add body bullets
    if (textBoxes.length === 1 && totalWords <= 10) {
      enhancementType = 'expand_title';
      const titleText = textBoxes[0]!.text;
      const bodyText = deriveBodyFromTitle(titleText);
      const bodyId = uuidv4();

      operations.push({
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId,
        targetId: bodyId,
        actorType: 'agent',
        actorId: 'deck-enhance-agent',
        timestamp,
        payload: {
          node: {
            id: bodyId,
            type: 'textbox',
            x: 60,
            y: 150,
            width: 840,
            height: 300,
            content: [{ text: bodyText, fontSize: 20 }],
          } as Record<string, unknown> & { id: string; type: string },
          parentId: slideId,
        },
      });

      previews.push(`Added body text with bullet points derived from title "${titleText}"`);
    }

    // Case 2: Text-heavy slide - simplify to key points
    if (totalWords > 60) {
      enhancementType = enhancementType ? enhancementType + '+simplify' : 'simplify';

      for (const tb of textBoxes) {
        if (countWords(tb.text) <= 20) continue; // Skip short boxes

        const keyPoints = extractKeyPoints(tb.text);
        const simplified = keyPoints.map((kp) => `\u2022 ${kp}`).join('\n');

        operations.push({
          operationId: uuidv4(),
          type: 'update_node',
          artifactId,
          targetId: tb.id,
          actorType: 'agent',
          actorId: 'deck-enhance-agent',
          timestamp,
          payload: {
            patch: {
              content: [{ text: simplified, fontSize: 18 }],
            },
          },
        });

        previews.push(`Simplified "${tb.text.slice(0, 30)}..." to ${keyPoints.length} key points`);
      }
    }

    // Case 3: Always add decorative accent bar at bottom
    const accentBarId = uuidv4();
    operations.push({
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId,
      targetId: accentBarId,
      actorType: 'agent',
      actorId: 'deck-enhance-agent',
      timestamp,
      payload: {
        node: {
          id: accentBarId,
          type: 'shape',
          shapeType: 'rectangle',
          x: 0,
          y: 520,
          width: 960,
          height: 20,
          fill: '#1a73e8',
        } as Record<string, unknown> & { id: string; type: string },
        parentId: slideId,
      },
    });
    previews.push('Added decorative accent bar at bottom');

    // Add small accent rectangle in top-right corner
    const accentRectId = uuidv4();
    operations.push({
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId,
      targetId: accentRectId,
      actorType: 'agent',
      actorId: 'deck-enhance-agent',
      timestamp,
      payload: {
        node: {
          id: accentRectId,
          type: 'shape',
          shapeType: 'rectangle',
          x: 880,
          y: 0,
          width: 80,
          height: 8,
          fill: '#e8710a',
        } as Record<string, unknown> & { id: string; type: string },
        parentId: slideId,
      },
    });
    previews.push('Added accent rectangle');

    if (!enhancementType) enhancementType = 'decorate';

    const previewText = `Enhanced slide (${enhancementType}):\n${previews.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`;

    return {
      proposedOperations: operations,
      previewText,
      output: { enhancementType, operationCount: operations.length },
    };
  },
};
