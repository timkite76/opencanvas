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
    let slideTitles = context.parameters.slideTitles as string[];

    if (!title) {
      throw new Error('Missing required parameter: title');
    }
    if (!slideTitles || slideTitles.length === 0) {
      throw new Error('Missing required parameter: slideTitles (must be non-empty array)');
    }

    // If LLM is available, generate body content for each slide
    const slideContents: Array<{ title: string; body: string }> = [];

    if (context.callLlm) {
      // Real LLM call to generate slide content
      const systemPrompt = 'You are a presentation creator. Create slide content from the outline. For each slide, output the title on one line, then the body text, separated by --- between slides.';
      const userPrompt = `Create presentation content for topic "${title}" with these slides:\n\n${slideTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

      try {
        const response = await context.callLlm({ systemPrompt, userPrompt });
        const slides = response.split('---').map((s) => s.trim()).filter(Boolean);

        for (let i = 0; i < Math.min(slides.length, slideTitles.length); i++) {
          const slideText = slides[i] || '';
          const lines = slideText.split('\n').map((line) => line.trim()).filter(Boolean);
          const slideTitle = lines[0] || slideTitles[i] || '';
          const slideBody = lines.slice(1).join('\n') || `Content for: ${slideTitle}`;

          slideContents.push({ title: slideTitle, body: slideBody });
        }

        // Fill in any missing slides
        for (let i = slideContents.length; i < slideTitles.length; i++) {
          slideContents.push({
            title: slideTitles[i]!,
            body: `Content for: ${slideTitles[i]}`,
          });
        }
      } catch (error) {
        // Fall through to deterministic content
      }
    }

    if (slideContents.length === 0) {
      // Fallback: generate basic content
      for (let i = 0; i < slideTitles.length; i++) {
        const slideTitle = i === 0 ? title : slideTitles[i]!;
        const body = i === 0 ? `Presentation: ${title}` : `Content for: ${slideTitles[i]}`;
        slideContents.push({ title: slideTitle, body });
      }
    }

    const artifactId = context.artifact.artifactId;
    const rootNodeId = context.artifact.rootNodeId;
    const timestamp = new Date().toISOString();
    const operations: InsertNodeOperation[] = [];

    for (let i = 0; i < slideContents.length; i++) {
      const slideContent = slideContents[i]!;
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
            content: [{ text: slideContent.title, bold: true, fontSize: 36 }],
          } as Record<string, unknown> & { id: string; type: string },
          parentId: slideId,
        },
      });

      // Insert body text box
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
            content: [{ text: slideContent.body, fontSize: 20 }],
          } as Record<string, unknown> & { id: string; type: string },
          parentId: slideId,
        },
      });
    }

    const previewLines = slideContents.map((s, i) => `  ${i + 1}. ${s.title}`);
    const previewText = `Create deck "${title}" with ${slideContents.length} slides:\n${previewLines.join('\n')}`;

    return {
      proposedOperations: operations,
      previewText,
      output: { slideCount: slideContents.length },
    };
  },
};
