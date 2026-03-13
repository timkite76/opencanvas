import { v4 as uuidv4 } from 'uuid';
import type { InsertNodeOperation } from '@opencanvas/core-types';
import type { RegisteredFunction, FunctionExecutionContext, FunctionResult } from '@opencanvas/function-sdk';
import { getNodePlainText, type WriteNode } from '@opencanvas/write-model';

/**
 * Extracts the first sentence from a text block.
 */
function extractFirstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const sentenceMatch = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return sentenceMatch ? sentenceMatch[1] : trimmed;
}

/**
 * Walks the artifact tree depth-first, collecting heading + content pairs
 * to build a section-aware summary.
 */
function buildSummary(context: FunctionExecutionContext): string {
  const { artifact } = context;
  const rootNode = artifact.nodes[artifact.rootNodeId];
  if (!rootNode?.childIds) return '';

  const sections: Array<{ heading: string; firstSentence: string }> = [];
  let currentHeading = '';
  let foundContentForHeading = false;

  // Walk all children of the root (or section containers)
  function walkChildren(childIds: string[]): void {
    for (const childId of childIds) {
      const node = artifact.nodes[childId] as WriteNode | undefined;
      if (!node) continue;

      if (node.type === 'section') {
        // Recurse into section children
        if (node.childIds) {
          walkChildren(node.childIds);
        }
        continue;
      }

      if (node.type === 'heading') {
        const headingText = getNodePlainText(node);
        if (headingText) {
          // Save previous section if we had content
          if (currentHeading && !foundContentForHeading) {
            sections.push({ heading: currentHeading, firstSentence: '' });
          }
          currentHeading = headingText;
          foundContentForHeading = false;
        }
        continue;
      }

      if (node.type === 'paragraph' || node.type === 'list_item' || node.type === 'semantic_block') {
        const text = getNodePlainText(node);
        if (text && currentHeading && !foundContentForHeading) {
          const sentence = extractFirstSentence(text);
          if (sentence) {
            sections.push({ heading: currentHeading, firstSentence: sentence });
            foundContentForHeading = true;
          }
        }
        continue;
      }

      // Walk nested structures (lists, tables, etc.)
      if (node.childIds) {
        walkChildren(node.childIds);
      }
    }
  }

  walkChildren(rootNode.childIds);

  // If the last heading had no content, still include it
  if (currentHeading && !foundContentForHeading) {
    sections.push({ heading: currentHeading, firstSentence: '' });
  }

  if (sections.length === 0) {
    // No sections found; gather first sentences from all paragraphs
    const allText: string[] = [];
    for (const nodeId of Object.keys(artifact.nodes)) {
      const node = artifact.nodes[nodeId] as WriteNode | undefined;
      if (node && (node.type === 'paragraph' || node.type === 'list_item')) {
        const text = getNodePlainText(node);
        if (text) {
          const sentence = extractFirstSentence(text);
          if (sentence) allText.push(sentence);
        }
      }
    }
    return allText.slice(0, 5).join(' ');
  }

  // Build the summary paragraph
  const summaryParts = sections
    .filter((s) => s.firstSentence)
    .map((s) => `Regarding ${s.heading.toLowerCase()}: ${s.firstSentence}`);

  return summaryParts.join(' ');
}

export const summarizeDocumentFunction: RegisteredFunction = {
  name: 'summarize_document',
  description: 'Generate an executive summary of the entire document by extracting key sentences from each section',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  outputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
    },
  },
  permissions: {
    scope: 'artifact',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const summaryText = buildSummary(context);

    if (!summaryText) {
      throw new Error('Could not generate summary: no text content found in the document');
    }

    const { artifact } = context;
    const rootNode = artifact.nodes[artifact.rootNodeId];
    if (!rootNode?.childIds) {
      throw new Error('Document has no root node with children');
    }

    // Find the parent to insert into. If root has sections, insert into the first
    // section-like parent; otherwise insert directly under root.
    let insertParentId = artifact.rootNodeId;
    const firstChild = artifact.nodes[rootNode.childIds[0]];
    if (firstChild?.type === 'section' && firstChild.childIds) {
      insertParentId = firstChild.id;
    }

    const headingId = `heading-summary-${uuidv4().slice(0, 8)}`;
    const paraId = `para-summary-${uuidv4().slice(0, 8)}`;

    const insertHeadingOp: InsertNodeOperation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: headingId,
      actorType: 'agent',
      actorId: 'writer-agent',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: headingId,
          type: 'heading',
          level: 2,
          content: [{ text: 'Executive Summary' }],
        } as import('@opencanvas/core-types').BaseNode,
        parentId: insertParentId,
        index: 0,
      },
    };

    const insertParaOp: InsertNodeOperation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: paraId,
      actorType: 'agent',
      actorId: 'writer-agent',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: paraId,
          type: 'paragraph',
          content: [{ text: summaryText }],
        } as import('@opencanvas/core-types').BaseNode,
        parentId: insertParentId,
        index: 1,
      },
    };

    return {
      proposedOperations: [insertHeadingOp, insertParaOp],
      previewText: `Executive Summary\n\n${summaryText}`,
      output: { summary: summaryText },
    };
  },
};
