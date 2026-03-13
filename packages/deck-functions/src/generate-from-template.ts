import { v4 as uuidv4 } from 'uuid';
import type { InsertNodeOperation } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

type TemplateType =
  | 'title_slide'
  | 'section_header'
  | 'two_column'
  | 'bullet_list'
  | 'comparison'
  | 'quote';

interface TemplateNode {
  type: 'textbox' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: Array<{ text: string; bold?: boolean; fontSize?: number; italic?: boolean }>;
  shapeType?: string;
  fill?: string;
}

function buildTemplate(templateType: TemplateType, title: string, subtitle: string): TemplateNode[] {
  switch (templateType) {
    case 'title_slide':
      return [
        {
          type: 'textbox',
          x: 120,
          y: 160,
          width: 720,
          height: 100,
          content: [{ text: title || 'Presentation Title', bold: true, fontSize: 44 }],
        },
        {
          type: 'textbox',
          x: 120,
          y: 280,
          width: 720,
          height: 60,
          content: [{ text: subtitle || 'Subtitle or author name', fontSize: 22 }],
        },
      ];

    case 'section_header':
      return [
        {
          type: 'shape',
          shapeType: 'rectangle',
          x: 0,
          y: 0,
          width: 960,
          height: 540,
          fill: '#1a73e8',
        },
        {
          type: 'textbox',
          x: 80,
          y: 200,
          width: 800,
          height: 80,
          content: [{ text: title || 'Section Title', bold: true, fontSize: 40 }],
        },
        {
          type: 'textbox',
          x: 80,
          y: 300,
          width: 800,
          height: 50,
          content: [{ text: subtitle || '', fontSize: 20 }],
        },
      ];

    case 'two_column':
      return [
        {
          type: 'textbox',
          x: 60,
          y: 40,
          width: 840,
          height: 70,
          content: [{ text: title || 'Two Column Layout', bold: true, fontSize: 32 }],
        },
        {
          type: 'textbox',
          x: 60,
          y: 130,
          width: 400,
          height: 360,
          content: [{ text: 'Left column content', fontSize: 18 }],
        },
        {
          type: 'textbox',
          x: 500,
          y: 130,
          width: 400,
          height: 360,
          content: [{ text: 'Right column content', fontSize: 18 }],
        },
      ];

    case 'bullet_list':
      return [
        {
          type: 'textbox',
          x: 60,
          y: 40,
          width: 840,
          height: 70,
          content: [{ text: title || 'Key Points', bold: true, fontSize: 32 }],
        },
        {
          type: 'textbox',
          x: 60,
          y: 130,
          width: 840,
          height: 370,
          content: [{ text: '\u2022 First point\n\u2022 Second point\n\u2022 Third point\n\u2022 Fourth point', fontSize: 22 }],
        },
      ];

    case 'comparison':
      return [
        {
          type: 'textbox',
          x: 60,
          y: 30,
          width: 840,
          height: 60,
          content: [{ text: title || 'Comparison', bold: true, fontSize: 32 }],
        },
        // Left column header
        {
          type: 'shape',
          shapeType: 'rectangle',
          x: 60,
          y: 110,
          width: 400,
          height: 50,
          fill: '#1a73e8',
        },
        {
          type: 'textbox',
          x: 60,
          y: 115,
          width: 400,
          height: 40,
          content: [{ text: 'Option A', bold: true, fontSize: 20 }],
        },
        {
          type: 'textbox',
          x: 60,
          y: 175,
          width: 400,
          height: 320,
          content: [{ text: '\u2022 Feature 1\n\u2022 Feature 2\n\u2022 Feature 3', fontSize: 18 }],
        },
        // Right column header
        {
          type: 'shape',
          shapeType: 'rectangle',
          x: 500,
          y: 110,
          width: 400,
          height: 50,
          fill: '#e8710a',
        },
        {
          type: 'textbox',
          x: 500,
          y: 115,
          width: 400,
          height: 40,
          content: [{ text: 'Option B', bold: true, fontSize: 20 }],
        },
        {
          type: 'textbox',
          x: 500,
          y: 175,
          width: 400,
          height: 320,
          content: [{ text: '\u2022 Feature 1\n\u2022 Feature 2\n\u2022 Feature 3', fontSize: 18 }],
        },
      ];

    case 'quote':
      return [
        {
          type: 'shape',
          shapeType: 'rectangle',
          x: 0,
          y: 0,
          width: 960,
          height: 540,
          fill: '#f8f9fa',
        },
        {
          type: 'shape',
          shapeType: 'rectangle',
          x: 80,
          y: 160,
          width: 6,
          height: 180,
          fill: '#1a73e8',
        },
        {
          type: 'textbox',
          x: 120,
          y: 170,
          width: 720,
          height: 120,
          content: [{ text: title || 'Your quote goes here.', italic: true, fontSize: 28 }],
        },
        {
          type: 'textbox',
          x: 120,
          y: 320,
          width: 720,
          height: 40,
          content: [{ text: subtitle || '-- Attribution', fontSize: 18 }],
        },
      ];

    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
}

export const generateFromTemplateFunction: RegisteredFunction = {
  name: 'generate_from_template',
  description: 'Generate a slide from a predefined template type with pre-positioned objects',
  inputSchema: {
    type: 'object',
    properties: {
      templateType: {
        type: 'string',
        enum: ['title_slide', 'section_header', 'two_column', 'bullet_list', 'comparison', 'quote'],
        description: 'The template type to generate',
      },
      title: {
        type: 'string',
        description: 'Title text for the template (optional)',
      },
      subtitle: {
        type: 'string',
        description: 'Subtitle or secondary text (optional)',
      },
    },
    required: ['templateType'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      slideId: { type: 'string' },
      nodeCount: { type: 'number' },
    },
  },
  permissions: {
    scope: 'artifact',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const templateType = context.parameters.templateType as TemplateType;
    let title = (context.parameters.title as string) ?? '';
    let subtitle = (context.parameters.subtitle as string) ?? '';

    // If LLM is available and we have a title, generate enhanced content
    if (context.callLlm && title) {
      const systemPrompt = 'You are a presentation designer. Given a slide title and template type, suggest enhanced title and subtitle text. Return the title on the first line and subtitle on the second line.';
      const userPrompt = `Template: ${templateType}\nTitle: ${title}\n\nSuggest enhanced title and subtitle:`;

      try {
        const response = await context.callLlm({ systemPrompt, userPrompt, maxTokens: 200 });
        const lines = response.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length >= 1) {
          title = lines[0]!;
        }
        if (lines.length >= 2) {
          subtitle = lines[1]!;
        }
      } catch (error) {
        // Use original values
      }
    }

    const templateNodes = buildTemplate(templateType, title, subtitle);
    const artifactId = context.artifact.artifactId;
    const rootNodeId = context.artifact.rootNodeId;
    const timestamp = new Date().toISOString();
    const slideId = uuidv4();
    const childIds: string[] = [];
    const operations: InsertNodeOperation[] = [];

    // Build child IDs first
    for (let i = 0; i < templateNodes.length; i++) {
      childIds.push(uuidv4());
    }

    // Insert slide node
    operations.push({
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId,
      targetId: slideId,
      actorType: 'agent',
      actorId: 'deck-template-agent',
      timestamp,
      payload: {
        node: {
          id: slideId,
          type: 'slide',
          childIds,
        },
        parentId: rootNodeId,
      },
    });

    // Insert each template node
    for (let i = 0; i < templateNodes.length; i++) {
      const tNode = templateNodes[i]!;
      const nodeId = childIds[i]!;

      const node: Record<string, unknown> & { id: string; type: string } = {
        id: nodeId,
        type: tNode.type,
        x: tNode.x,
        y: tNode.y,
        width: tNode.width,
        height: tNode.height,
      };

      if (tNode.content) {
        node.content = tNode.content;
      }
      if (tNode.shapeType) {
        node.shapeType = tNode.shapeType;
      }
      if (tNode.fill) {
        node.fill = tNode.fill;
      }

      operations.push({
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId,
        targetId: nodeId,
        actorType: 'agent',
        actorId: 'deck-template-agent',
        timestamp,
        payload: {
          node,
          parentId: slideId,
        },
      });
    }

    const templateLabels: Record<string, string> = {
      title_slide: 'Title Slide',
      section_header: 'Section Header',
      two_column: 'Two Column',
      bullet_list: 'Bullet List',
      comparison: 'Comparison',
      quote: 'Quote',
    };

    const label = templateLabels[templateType] ?? templateType;
    const previewText = `Create "${label}" slide with ${templateNodes.length} elements${title ? ` (title: "${title}")` : ''}`;

    return {
      proposedOperations: operations,
      previewText,
      output: { slideId, nodeCount: templateNodes.length },
    };
  },
};
