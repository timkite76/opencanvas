import { v4 as uuidv4 } from 'uuid';
import type { InsertNodeOperation } from '@opencanvas/core-types';
import type { RegisteredFunction, FunctionExecutionContext, FunctionResult } from '@opencanvas/function-sdk';

/**
 * Generates a document outline based on a topic string.
 * Produces a main heading, subheadings with placeholder paragraphs
 * derived from the topic content itself.
 */
function generateOutlineStructure(topic: string): Array<{ type: 'heading' | 'paragraph'; level?: number; text: string }> {
  const topicLower = topic.toLowerCase().trim();
  const topicCapitalized = topic.charAt(0).toUpperCase() + topic.slice(1);
  const structure: Array<{ type: 'heading' | 'paragraph'; level?: number; text: string }> = [];

  // Main title
  structure.push({ type: 'heading', level: 1, text: topicCapitalized });
  structure.push({
    type: 'paragraph',
    text: `This document provides a comprehensive overview of ${topicLower}. The following sections outline the key aspects, considerations, and recommendations.`,
  });

  // Generate contextual subheadings based on topic keywords
  const technicalKeywords = ['software', 'system', 'api', 'platform', 'architecture', 'code', 'technical', 'engineering', 'development', 'infrastructure'];
  const businessKeywords = ['strategy', 'business', 'market', 'revenue', 'growth', 'plan', 'proposal', 'budget', 'investment'];
  const projectKeywords = ['project', 'initiative', 'implementation', 'migration', 'launch', 'rollout', 'deployment'];
  const researchKeywords = ['research', 'study', 'analysis', 'investigation', 'experiment', 'hypothesis'];
  const designKeywords = ['design', 'ux', 'ui', 'interface', 'experience', 'prototype', 'wireframe'];

  const topicWords = topicLower.split(/\s+/);
  const isTechnical = topicWords.some((w) => technicalKeywords.includes(w));
  const isBusiness = topicWords.some((w) => businessKeywords.includes(w));
  const isProject = topicWords.some((w) => projectKeywords.includes(w));
  const isResearch = topicWords.some((w) => researchKeywords.includes(w));
  const isDesign = topicWords.some((w) => designKeywords.includes(w));

  if (isTechnical) {
    structure.push({ type: 'heading', level: 2, text: 'Technical Overview' });
    structure.push({ type: 'paragraph', text: `A high-level description of the technical components and architecture related to ${topicLower}.` });

    structure.push({ type: 'heading', level: 2, text: 'Requirements and Specifications' });
    structure.push({ type: 'paragraph', text: `The functional and non-functional requirements that define the scope of ${topicLower}.` });

    structure.push({ type: 'heading', level: 2, text: 'Implementation Approach' });
    structure.push({ type: 'paragraph', text: `The proposed implementation strategy, including technology choices, dependencies, and phases.` });

    structure.push({ type: 'heading', level: 2, text: 'Testing and Validation' });
    structure.push({ type: 'paragraph', text: `The testing strategy to ensure quality, reliability, and performance targets are met.` });

    structure.push({ type: 'heading', level: 2, text: 'Deployment and Operations' });
    structure.push({ type: 'paragraph', text: `The deployment plan, monitoring approach, and operational considerations for production readiness.` });
  } else if (isBusiness) {
    structure.push({ type: 'heading', level: 2, text: 'Executive Summary' });
    structure.push({ type: 'paragraph', text: `A concise overview of the business case for ${topicLower} and its expected impact.` });

    structure.push({ type: 'heading', level: 2, text: 'Market Analysis' });
    structure.push({ type: 'paragraph', text: `An assessment of the current market landscape and the opportunity that ${topicLower} addresses.` });

    structure.push({ type: 'heading', level: 2, text: 'Strategic Objectives' });
    structure.push({ type: 'paragraph', text: `The key objectives and measurable outcomes expected from this initiative.` });

    structure.push({ type: 'heading', level: 2, text: 'Financial Projections' });
    structure.push({ type: 'paragraph', text: `Revenue projections, cost analysis, and return on investment estimates.` });

    structure.push({ type: 'heading', level: 2, text: 'Risk Assessment' });
    structure.push({ type: 'paragraph', text: `Identified risks, their potential impact, and proposed mitigation strategies.` });
  } else if (isResearch) {
    structure.push({ type: 'heading', level: 2, text: 'Background and Context' });
    structure.push({ type: 'paragraph', text: `The existing body of knowledge and context that informs this ${topicLower}.` });

    structure.push({ type: 'heading', level: 2, text: 'Methodology' });
    structure.push({ type: 'paragraph', text: `The research methodology, data sources, and analytical framework employed.` });

    structure.push({ type: 'heading', level: 2, text: 'Findings' });
    structure.push({ type: 'paragraph', text: `The key findings and observations from the ${topicLower}.` });

    structure.push({ type: 'heading', level: 2, text: 'Discussion' });
    structure.push({ type: 'paragraph', text: `An interpretation of the findings and their implications for the broader context.` });

    structure.push({ type: 'heading', level: 2, text: 'Conclusions and Recommendations' });
    structure.push({ type: 'paragraph', text: `The conclusions drawn from this work and recommended next steps.` });
  } else if (isDesign) {
    structure.push({ type: 'heading', level: 2, text: 'Design Goals' });
    structure.push({ type: 'paragraph', text: `The primary design objectives and principles guiding ${topicLower}.` });

    structure.push({ type: 'heading', level: 2, text: 'User Research' });
    structure.push({ type: 'paragraph', text: `Insights from user research that inform the design decisions.` });

    structure.push({ type: 'heading', level: 2, text: 'Information Architecture' });
    structure.push({ type: 'paragraph', text: `The structural organization and navigation model for the experience.` });

    structure.push({ type: 'heading', level: 2, text: 'Visual Design' });
    structure.push({ type: 'paragraph', text: `The visual language, typography, color system, and component library.` });

    structure.push({ type: 'heading', level: 2, text: 'Interaction Patterns' });
    structure.push({ type: 'paragraph', text: `The key interaction flows and micro-interactions that define the user experience.` });
  } else {
    // Generic outline structure
    structure.push({ type: 'heading', level: 2, text: 'Background' });
    structure.push({ type: 'paragraph', text: `The context and background information relevant to ${topicLower}.` });

    structure.push({ type: 'heading', level: 2, text: 'Objectives' });
    structure.push({ type: 'paragraph', text: `The primary objectives and expected outcomes for ${topicLower}.` });

    structure.push({ type: 'heading', level: 2, text: 'Approach' });
    structure.push({ type: 'paragraph', text: `The proposed approach and key activities involved in ${topicLower}.` });

    if (isProject) {
      structure.push({ type: 'heading', level: 2, text: 'Timeline and Milestones' });
      structure.push({ type: 'paragraph', text: `The project timeline, key milestones, and delivery schedule.` });

      structure.push({ type: 'heading', level: 2, text: 'Resources and Dependencies' });
      structure.push({ type: 'paragraph', text: `The resources required and external dependencies that may affect delivery.` });
    }

    structure.push({ type: 'heading', level: 2, text: 'Risks and Considerations' });
    structure.push({ type: 'paragraph', text: `Key risks, constraints, and considerations that should be addressed.` });

    structure.push({ type: 'heading', level: 2, text: 'Next Steps' });
    structure.push({ type: 'paragraph', text: `The recommended next steps and immediate actions to move forward.` });
  }

  return structure;
}

export const generateOutlineFunction: RegisteredFunction = {
  name: 'generate_outline',
  description: 'Generate a document outline with headings and placeholder paragraphs based on a topic',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'The topic to generate an outline for' },
    },
    required: ['topic'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      sections: { type: 'array', items: { type: 'string' } },
    },
  },
  permissions: {
    scope: 'artifact',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const topic = context.parameters.topic as string;
    if (!topic || topic.trim().length === 0) {
      throw new Error('A topic is required to generate an outline');
    }

    const { artifact } = context;
    const rootNode = artifact.nodes[artifact.rootNodeId];
    if (!rootNode?.childIds) {
      throw new Error('Document has no root node with children');
    }

    // Insert at the beginning or end of the document
    let insertParentId = artifact.rootNodeId;
    const firstChild = artifact.nodes[rootNode.childIds[0]];
    if (firstChild?.type === 'section' && firstChild.childIds) {
      insertParentId = firstChild.id;
    }

    const outlineItems = generateOutlineStructure(topic);
    const operations: InsertNodeOperation[] = [];
    const previewLines: string[] = [];

    for (let i = 0; i < outlineItems.length; i++) {
      const item = outlineItems[i];
      const prefix = item.type === 'heading' ? `h${item.level}-outline` : 'para-outline';
      const nodeId = `${prefix}-${uuidv4().slice(0, 8)}`;

      const nodeData: Record<string, unknown> = {
        id: nodeId,
        type: item.type === 'heading' ? 'heading' : 'paragraph',
        content: [{ text: item.text }],
      };

      if (item.type === 'heading' && item.level) {
        nodeData.level = item.level;
      }

      operations.push({
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId: artifact.artifactId,
        targetId: nodeId,
        actorType: 'agent',
        actorId: 'writer-agent',
        timestamp: new Date().toISOString(),
        payload: {
          node: nodeData as unknown as import('@opencanvas/core-types').BaseNode,
          parentId: insertParentId,
          index: i,
        },
      });

      if (item.type === 'heading') {
        const indent = item.level === 1 ? '' : '  ';
        previewLines.push(`${indent}${'#'.repeat(item.level ?? 1)} ${item.text}`);
      } else {
        previewLines.push(`  ${item.text}`);
      }
    }

    const sections = outlineItems
      .filter((item) => item.type === 'heading')
      .map((item) => item.text);

    return {
      proposedOperations: operations,
      previewText: previewLines.join('\n'),
      output: { sections },
    };
  },
};
