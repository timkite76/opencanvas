import { v4 as uuidv4 } from 'uuid';
import type { UpdateNodeOperation, InsertNodeOperation, BaseNode } from '@opencanvas/core-types';
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

interface LayoutSuggestion {
  type: 'split' | 'add_title' | 'center' | 'reposition';
  description: string;
}

function analyzeContentDensity(
  textBoxes: Array<{ id: string; node: AnyNode; text: string }>,
): LayoutSuggestion[] {
  const suggestions: LayoutSuggestion[] = [];
  const totalWords = textBoxes.reduce((sum, tb) => sum + countWords(tb.text), 0);
  const boxCount = textBoxes.length;

  // Too much text overall - suggest splitting
  if (totalWords > 100) {
    suggestions.push({
      type: 'split',
      description: `This slide has ${totalWords} words across ${boxCount} text box(es). Consider splitting into 2 slides for better readability.`,
    });
  }

  // Single text box with no title-like element
  if (boxCount === 1) {
    const singleBox = textBoxes[0]!;
    const content = singleBox.node.content as Array<{ bold?: boolean; fontSize?: number }> | undefined;
    const isBold = content?.[0]?.bold ?? false;
    const fontSize = content?.[0]?.fontSize ?? 16;

    if (!isBold && fontSize < 28) {
      suggestions.push({
        type: 'add_title',
        description: 'This slide has a single text box without a clear title. Add a title bar at the top for better structure.',
      });
    }

    if (totalWords < 20) {
      suggestions.push({
        type: 'center',
        description: 'This slide has minimal text. Center the content for visual impact.',
      });
    }
  }

  // Multiple text boxes that could be repositioned
  if (boxCount >= 2) {
    const overlapping = textBoxes.some((a, i) =>
      textBoxes.some((b, j) => {
        if (i >= j) return false;
        const ax = (a.node.x as number) ?? 0;
        const ay = (a.node.y as number) ?? 0;
        const aw = (a.node.width as number) ?? 100;
        const ah = (a.node.height as number) ?? 50;
        const bx = (b.node.x as number) ?? 0;
        const by = (b.node.y as number) ?? 0;
        const bw = (b.node.width as number) ?? 100;
        const bh = (b.node.height as number) ?? 50;
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
      }),
    );

    if (overlapping) {
      suggestions.push({
        type: 'reposition',
        description: 'Some text boxes overlap. Reposition them for cleaner layout.',
      });
    }
  }

  return suggestions;
}

export const suggestLayoutFunction: RegisteredFunction = {
  name: 'suggest_layout',
  description: 'Analyze a slide\'s content density and suggest layout improvements with proposed operations',
  inputSchema: {
    type: 'object',
    properties: {
      slideId: { type: 'string', description: 'The slide node ID to analyze' },
    },
    required: ['slideId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
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
      throw new Error('No text boxes found on this slide to analyze');
    }

    let suggestions: LayoutSuggestion[];

    if (context.callLlm) {
      // Real LLM call - describe the slide layout
      const totalWords = textBoxes.reduce((sum, tb) => sum + countWords(tb.text), 0);
      const layoutDescription = `Slide has ${textBoxes.length} text box(es) with ${totalWords} total words.\n` +
        textBoxes.map((tb, i) => `Text box ${i + 1}: "${tb.text.slice(0, 50)}..." (${countWords(tb.text)} words)`).join('\n');

      const systemPrompt = 'You are a presentation designer. Suggest the best layout for this slide content. Return the layout name on the first line, then a brief explanation.';
      const userPrompt = `Suggest layout improvements for this slide:\n\n${layoutDescription}`;

      try {
        const response = await context.callLlm({ systemPrompt, userPrompt });
        const lines = response.split('\n').map((line) => line.trim()).filter(Boolean);

        // Parse suggestions
        suggestions = lines.map((line) => ({
          type: 'reposition' as const,
          description: line,
        }));

        if (suggestions.length === 0) {
          suggestions = analyzeContentDensity(textBoxes);
        }
      } catch (error) {
        // Fall through to deterministic logic
        suggestions = analyzeContentDensity(textBoxes);
      }
    } else {
      // Fallback to deterministic logic
      suggestions = analyzeContentDensity(textBoxes);
    }
    const operations: Array<UpdateNodeOperation | InsertNodeOperation> = [];
    const timestamp = new Date().toISOString();
    const artifactId = context.artifact.artifactId;

    for (const suggestion of suggestions) {
      if (suggestion.type === 'center' && textBoxes.length === 1) {
        const tb = textBoxes[0]!;
        const currentWidth = (tb.node.width as number) ?? 400;
        const centeredX = Math.round((960 - currentWidth) / 2);
        const centeredY = Math.round((540 - ((tb.node.height as number) ?? 100)) / 2);

        operations.push({
          operationId: uuidv4(),
          type: 'update_node',
          artifactId,
          targetId: tb.id,
          actorType: 'agent',
          actorId: 'deck-layout-agent',
          timestamp,
          payload: {
            patch: { x: centeredX, y: centeredY },
          },
        });
      }

      if (suggestion.type === 'add_title') {
        const titleId = uuidv4();
        // Move existing content down
        const tb = textBoxes[0]!;
        operations.push({
          operationId: uuidv4(),
          type: 'update_node',
          artifactId,
          targetId: tb.id,
          actorType: 'agent',
          actorId: 'deck-layout-agent',
          timestamp,
          payload: {
            patch: { y: 150, height: 340 },
          },
        });
        // Insert title text box
        const firstWords = tb.text.split(/\s+/).slice(0, 5).join(' ');
        operations.push({
          operationId: uuidv4(),
          type: 'insert_node',
          artifactId,
          targetId: titleId,
          actorType: 'agent',
          actorId: 'deck-layout-agent',
          timestamp,
          payload: {
            node: {
              id: titleId,
              type: 'textbox',
              x: 60,
              y: 40,
              width: 840,
              height: 80,
              content: [{ text: firstWords, bold: true, fontSize: 36 }],
            } as Record<string, unknown> & { id: string; type: string },
            parentId: slideId,
          },
        });
      }

      if (suggestion.type === 'reposition' && textBoxes.length >= 2) {
        // Stack text boxes vertically with even spacing
        const startY = 40;
        const availableHeight = 500;
        const gap = 10;
        const boxHeight = Math.floor((availableHeight - gap * (textBoxes.length - 1)) / textBoxes.length);

        textBoxes.forEach((tb, i) => {
          operations.push({
            operationId: uuidv4(),
            type: 'update_node',
            artifactId,
            targetId: tb.id,
            actorType: 'agent',
            actorId: 'deck-layout-agent',
            timestamp,
            payload: {
              patch: {
                x: 60,
                y: startY + i * (boxHeight + gap),
                width: 840,
                height: boxHeight,
              },
            },
          });
        });
      }
    }

    if (suggestions.length === 0) {
      return {
        proposedOperations: [],
        previewText: 'Layout looks good! No suggestions at this time.',
        output: { suggestions: [] },
      };
    }

    const previewLines = suggestions.map((s, i) => `  ${i + 1}. [${s.type}] ${s.description}`);
    const previewText = `Layout suggestions for this slide:\n${previewLines.join('\n')}${operations.length > 0 ? `\n\nProposed ${operations.length} operation(s) to improve layout.` : ''}`;

    return {
      proposedOperations: operations,
      previewText,
      output: { suggestions },
    };
  },
};
