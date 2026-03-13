import { v4 as uuidv4 } from 'uuid';
import type { InsertNodeOperation } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

export const createDeckFromOutlineFunction: RegisteredFunction = {
  name: 'create_deck_from_outline',
  description:
    'Create a presentation deck from a title and list of slide titles, generating slides with title and body text boxes',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The presentation title (used on the first slide)',
      },
      slideTitles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of slide titles to generate',
      },
    },
    required: ['title', 'slideTitles'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      slideCount: { type: 'number' },
    },
  },
  permissions: {
    scope: 'artifact',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const title = context.parameters.title as string;
    const slideTitles = context.parameters.slideTitles as string[];

    if (!title) {
      throw new Error('Missing required parameter: title');
    }
    if (!slideTitles || slideTitles.length === 0) {
      throw new Error('Missing required parameter: slideTitles (must be non-empty array)');
    }

    const artifactId = context.artifact.artifactId;
    const rootNodeId = context.artifact.rootNodeId;
    const timestamp = new Date().toISOString();
    const operations: InsertNodeOperation[] = [];

    for (let i = 0; i < slideTitles.length; i++) {
      const slideTitle = slideTitles[i]!;
      const slideId = uuidv4();
      const titleBoxId = uuidv4();
      const bodyBoxId = uuidv4();

      // Insert slide node
      operations.push({
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId,
        targetId: slideId,
        actorType: 'agent',
        actorId: 'deck-outline-agent',
        timestamp,
        payload: {
          node: {
            id: slideId,
            type: 'slide',
            childIds: [titleBoxId, bodyBoxId],
          },
          parentId: rootNodeId,
        },
      });

      // Insert title text box
      operations.push({
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId,
        targetId: titleBoxId,
        actorType: 'agent',
        actorId: 'deck-outline-agent',
        timestamp,
        payload: {
          node: {
            id: titleBoxId,
            type: 'textbox',
            x: 60,
            y: 40,
            width: 840,
            height: 80,
            content: [{ text: i === 0 ? title : slideTitle, bold: true, fontSize: 36 }],
          } as Record<string, unknown> & { id: string; type: string },
          parentId: slideId,
        },
      });

      // Insert body text box
      const bodyText = i === 0
        ? `Presentation: ${title}`
        : `Content for: ${slideTitle}`;

      operations.push({
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId,
        targetId: bodyBoxId,
        actorType: 'agent',
        actorId: 'deck-outline-agent',
        timestamp,
        payload: {
          node: {
            id: bodyBoxId,
            type: 'textbox',
            x: 60,
            y: 150,
            width: 840,
            height: 340,
            content: [{ text: bodyText, fontSize: 20 }],
          } as Record<string, unknown> & { id: string; type: string },
          parentId: slideId,
        },
      });
    }

    const previewLines = slideTitles.map((t, i) => `  ${i + 1}. ${t}`);
    const previewText = `Create deck "${title}" with ${slideTitles.length} slides:\n${previewLines.join('\n')}`;

    return {
      proposedOperations: operations,
      previewText,
      output: { slideCount: slideTitles.length },
    };
  },
};
