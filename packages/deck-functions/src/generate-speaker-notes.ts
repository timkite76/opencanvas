import { v4 as uuidv4 } from 'uuid';
import type { InsertNodeOperation, BaseNode } from '@opencanvas/core-types';
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

function generateNotesFromSlideText(slideTexts: string[]): string {
  if (slideTexts.length === 0) return 'No text content found on this slide.';

  const title = slideTexts[0] ?? '';
  const bodyTexts = slideTexts.slice(1);

  let notes = `In this slide, we cover "${title}".`;

  if (bodyTexts.length > 0) {
    notes += ` Key points to discuss: ${bodyTexts.join(' ')}`;
  }

  notes += ' Remember to engage the audience and ask for questions.';
  return notes;
}

export const generateSpeakerNotesFunction: RegisteredFunction = {
  name: 'generate_speaker_notes',
  description: 'Generate speaker notes for a slide based on its text content',
  inputSchema: {
    type: 'object',
    properties: {
      slideId: { type: 'string', description: 'The slide node ID to generate notes for' },
    },
    required: ['slideId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      notesText: { type: 'string' },
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
    const slideTexts: string[] = [];

    for (const childId of childIds) {
      const child = context.artifact.nodes[childId] as unknown as AnyNode | undefined;
      if (!child || child.type !== 'textbox') continue;
      const text = getNodePlainText(child);
      if (text) slideTexts.push(text);
    }

    const notesText = generateNotesFromSlideText(slideTexts);
    const notesId = uuidv4();

    const op: InsertNodeOperation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: context.artifact.artifactId,
      targetId: notesId,
      actorType: 'agent',
      actorId: 'deck-notes-agent',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: notesId,
          type: 'speaker_notes',
          content: [{ text: notesText }],
        } as Record<string, unknown> & { id: string; type: string },
        parentId: slideId,
      },
    };

    return {
      proposedOperations: [op],
      previewText: `Speaker notes: ${notesText}`,
      output: { notesText },
    };
  },
};
