import { v4 as uuidv4 } from 'uuid';
import type { InsertNodeOperation } from '@opencanvas/core-types';
import type { RegisteredFunction, FunctionExecutionContext, FunctionResult } from '@opencanvas/function-sdk';
import { getNodePlainText, type WriteNode } from '@opencanvas/write-model';

/**
 * Scans text for action-like phrases and extracts the containing sentence.
 */
function extractActionSentences(text: string): string[] {
  const actionPatterns = [
    /\bshould\b/i,
    /\bmust\b/i,
    /\bneed to\b/i,
    /\bwill\b/i,
    /\bTODO\b/,
    /\baction:/i,
    /\bnext step/i,
    /\brequired to\b/i,
    /\bresponsible for\b/i,
    /\bensure that\b/i,
    /\bfollow up\b/i,
    /\bdeadline\b/i,
    /\bdeliver\b/i,
    /\bcomplete by\b/i,
    /\bassign\b/i,
  ];

  // Split into sentences
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const actionSentences: string[] = [];

  for (const sentence of sentences) {
    for (const pattern of actionPatterns) {
      if (pattern.test(sentence)) {
        const trimmed = sentence.trim();
        // Avoid duplicates
        if (!actionSentences.includes(trimmed)) {
          actionSentences.push(trimmed);
        }
        break;
      }
    }
  }

  return actionSentences;
}

export const extractActionItemsFunction: RegisteredFunction = {
  name: 'extract_action_items',
  description: 'Scan the document for action items and extract them into a structured list',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  outputSchema: {
    type: 'object',
    properties: {
      actionItems: { type: 'array', items: { type: 'string' } },
    },
  },
  permissions: {
    scope: 'artifact',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const { artifact } = context;
    const allActionItems: string[] = [];

    // Walk all nodes and collect action items from text content
    for (const nodeId of Object.keys(artifact.nodes)) {
      const node = artifact.nodes[nodeId] as WriteNode | undefined;
      if (!node) continue;

      if (node.type === 'paragraph' || node.type === 'list_item' || node.type === 'semantic_block') {
        const text = getNodePlainText(node);
        if (text) {
          const actions = extractActionSentences(text);
          allActionItems.push(...actions);
        }
      }
    }

    if (allActionItems.length === 0) {
      throw new Error('No action items found in the document');
    }

    // Deduplicate
    const uniqueItems = [...new Set(allActionItems)];

    // Build insert operations: heading + list with list_items
    const rootNode = artifact.nodes[artifact.rootNodeId];
    if (!rootNode?.childIds) {
      throw new Error('Document has no root node with children');
    }

    // Determine insert parent
    let insertParentId = artifact.rootNodeId;
    const lastChildId = rootNode.childIds[rootNode.childIds.length - 1];
    const lastChild = artifact.nodes[lastChildId];
    if (lastChild?.type === 'section' && lastChild.childIds) {
      insertParentId = lastChild.id;
    }

    // Count existing children to append at the end
    const parentNode = artifact.nodes[insertParentId];
    const insertIndex = parentNode?.childIds?.length ?? 0;

    const headingId = `heading-actions-${uuidv4().slice(0, 8)}`;
    const listId = `list-actions-${uuidv4().slice(0, 8)}`;

    const operations: InsertNodeOperation[] = [];

    // Insert heading
    operations.push({
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
          content: [{ text: 'Action Items' }],
        } as import('@opencanvas/core-types').BaseNode,
        parentId: insertParentId,
        index: insertIndex,
      },
    });

    // Insert list container
    operations.push({
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: listId,
      actorType: 'agent',
      actorId: 'writer-agent',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: listId,
          type: 'list',
          listType: 'bullet',
        } as import('@opencanvas/core-types').BaseNode,
        parentId: insertParentId,
        index: insertIndex + 1,
      },
    });

    // Insert each action item as a list_item
    for (let i = 0; i < uniqueItems.length; i++) {
      const itemId = `li-action-${uuidv4().slice(0, 8)}`;
      operations.push({
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId: artifact.artifactId,
        targetId: itemId,
        actorType: 'agent',
        actorId: 'writer-agent',
        timestamp: new Date().toISOString(),
        payload: {
          node: {
            id: itemId,
            type: 'list_item',
            content: [{ text: uniqueItems[i] }],
          } as import('@opencanvas/core-types').BaseNode,
          parentId: listId,
          index: i,
        },
      });
    }

    const previewText = `Action Items\n\n${uniqueItems.map((item) => `- ${item}`).join('\n')}`;

    return {
      proposedOperations: operations,
      previewText,
      output: { actionItems: uniqueItems },
    };
  },
};
