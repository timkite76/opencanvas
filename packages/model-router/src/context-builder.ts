/**
 * Context builders for different artifact types.
 *
 * These produce structured context objects that AI functions can use
 * to provide richer prompts to LLMs when they are integrated.
 */

import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { BaseNode, ObjectID } from '@opencanvas/core-types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function getNodeText(node: BaseNode): string {
  const content = (node as any).content as
    | Array<{ text: string }>
    | undefined;
  if (!content) return '';
  return content.map((r) => r.text).join('');
}

function getChildIds(node: BaseNode): ObjectID[] {
  return node.childIds ?? [];
}

// ---------------------------------------------------------------------------
// Write context
// ---------------------------------------------------------------------------

export interface WriteContext {
  documentTitle: string;
  documentSummary: string;
  nearbyBlocks: Array<{ id: string; type: string; text: string }>;
  selectedText: string | null;
  fullBlockText: string;
}

/**
 * Build a structured context for a write-document AI task.
 */
export function buildWriteContext(
  artifact: ArtifactEnvelope,
  targetId: ObjectID,
  selectionStart?: number,
  selectionEnd?: number,
): WriteContext {
  const rootNode = artifact.nodes[artifact.rootNodeId];
  const documentTitle = getNodeText(rootNode) || artifact.rootNodeId;

  // Build a summary from the first 500 characters of the document
  const allChildIds = getChildIds(rootNode);
  let summaryChars = '';
  for (const childId of allChildIds) {
    const child = artifact.nodes[childId];
    if (child) {
      summaryChars += getNodeText(child) + ' ';
    }
    if (summaryChars.length >= 500) break;
  }
  const documentSummary = summaryChars.slice(0, 500).trim();

  // Find target block and nearby blocks
  const targetNode = artifact.nodes[targetId];
  const fullBlockText = targetNode ? getNodeText(targetNode) : '';

  const nearbyBlocks: WriteContext['nearbyBlocks'] = [];
  if (targetNode?.parentId) {
    const parentNode = artifact.nodes[targetNode.parentId];
    const siblings = getChildIds(parentNode);
    const targetIndex = siblings.indexOf(targetId);

    const startIdx = Math.max(0, targetIndex - 3);
    const endIdx = Math.min(siblings.length - 1, targetIndex + 3);

    for (let i = startIdx; i <= endIdx; i++) {
      const sibId = siblings[i]!;
      const sibNode = artifact.nodes[sibId];
      if (sibNode) {
        nearbyBlocks.push({
          id: sibId,
          type: sibNode.type,
          text: getNodeText(sibNode),
        });
      }
    }
  }

  // Selected text
  let selectedText: string | null = null;
  if (selectionStart !== undefined && selectionEnd !== undefined && fullBlockText) {
    selectedText = fullBlockText.slice(selectionStart, selectionEnd);
  }

  return {
    documentTitle,
    documentSummary,
    nearbyBlocks,
    selectedText,
    fullBlockText,
  };
}

// ---------------------------------------------------------------------------
// Grid context
// ---------------------------------------------------------------------------

export interface GridContext {
  worksheetName: string;
  selectedCellAddress: string;
  selectedCellValue: string;
  selectedCellFormula: string;
  neighborCells: Array<{ address: string; value: string }>;
  columnValues: string[];
}

/**
 * Build a structured context for a grid/spreadsheet AI task.
 */
export function buildGridContext(
  artifact: ArtifactEnvelope,
  targetId: ObjectID,
): GridContext {
  const targetNode = artifact.nodes[targetId] as any;

  // Walk up to find worksheet name
  let worksheetName = 'Sheet1';
  if (targetNode?.parentId) {
    const parent = artifact.nodes[targetNode.parentId] as any;
    if (parent?.type === 'worksheet' && parent.name) {
      worksheetName = parent.name as string;
    }
  }

  const address: string = (targetNode?.address as string | undefined) ?? targetId;
  const rawValue: unknown = targetNode?.rawValue;
  const formula: string = (targetNode?.formula as string | undefined) ?? '';
  const cellValue = rawValue != null ? String(rawValue) : '';

  // Collect neighbor cells (try to find cells with adjacent addresses)
  const neighborCells: GridContext['neighborCells'] = [];
  const columnValues: string[] = [];

  // Parse address to find neighbors
  const colMatch = address.match(/^([A-Z]+)(\d+)$/);
  if (colMatch) {
    const colLetter = colMatch[1]!;
    const rowNum = parseInt(colMatch[2]!, 10);

    // Scan nodes for neighbors: same column within 20 rows, and adjacent columns
    const nodes = Object.values(artifact.nodes) as any[];
    for (const node of nodes) {
      if (!node.address) continue;

      const nodeColMatch = (node.address as string).match(/^([A-Z]+)(\d+)$/);
      if (!nodeColMatch) continue;

      const nodeCol = nodeColMatch[1]!;
      const nodeRow = parseInt(nodeColMatch[2]!, 10);

      // Same column: collect first 20 values
      if (nodeCol === colLetter && columnValues.length < 20) {
        const val = node.rawValue != null ? String(node.rawValue) : '';
        columnValues.push(val);
      }

      // Adjacent cells (within 1 row and 1 column)
      const colDiff = Math.abs(nodeCol.charCodeAt(0) - colLetter.charCodeAt(0));
      const rowDiff = Math.abs(nodeRow - rowNum);
      if (colDiff <= 1 && rowDiff <= 1 && node.id !== targetId) {
        neighborCells.push({
          address: node.address as string,
          value: node.rawValue != null ? String(node.rawValue) : '',
        });
      }
    }
  }

  return {
    worksheetName,
    selectedCellAddress: address,
    selectedCellValue: cellValue,
    selectedCellFormula: formula,
    neighborCells: neighborCells.slice(0, 8),
    columnValues,
  };
}

// ---------------------------------------------------------------------------
// Deck context
// ---------------------------------------------------------------------------

export interface DeckContext {
  presentationTitle: string;
  slideIndex: number;
  slideTitle: string;
  slideObjectCount: number;
  allSlideTitles: string[];
}

/**
 * Build a structured context for a deck/presentation AI task.
 */
export function buildDeckContext(
  artifact: ArtifactEnvelope,
  targetId: ObjectID,
): DeckContext {
  const rootNode = artifact.nodes[artifact.rootNodeId];
  const presentationTitle = getNodeText(rootNode) || 'Untitled Presentation';

  // Collect all slide titles
  const allSlideIds = getChildIds(rootNode);
  const allSlideTitles: string[] = [];
  let slideIndex = -1;

  for (let i = 0; i < allSlideIds.length; i++) {
    const slideId = allSlideIds[i]!;
    const slideNode = artifact.nodes[slideId];
    if (!slideNode) {
      allSlideTitles.push('');
      continue;
    }

    // Try to extract title from the slide's first text child
    const slideChildren = getChildIds(slideNode);
    let title = '';
    for (const childId of slideChildren) {
      const child = artifact.nodes[childId];
      if (child) {
        const text = getNodeText(child);
        if (text) {
          title = text;
          break;
        }
      }
    }
    allSlideTitles.push(title || `Slide ${i + 1}`);

    if (slideId === targetId) {
      slideIndex = i;
    }
  }

  // If targetId is not a direct child of root, it might be a child of a slide
  const targetNode = artifact.nodes[targetId];
  let slideTitle = '';
  let slideObjectCount = 0;

  if (slideIndex >= 0) {
    slideTitle = allSlideTitles[slideIndex] ?? '';
    slideObjectCount = getChildIds(targetNode).length;
  } else if (targetNode?.parentId) {
    // targetId is likely a child of a slide; find the parent slide
    const parentSlide = artifact.nodes[targetNode.parentId];
    if (parentSlide) {
      slideIndex = allSlideIds.indexOf(targetNode.parentId);
      slideTitle = slideIndex >= 0 ? (allSlideTitles[slideIndex] ?? '') : '';
      slideObjectCount = getChildIds(parentSlide).length;
    }
  }

  return {
    presentationTitle,
    slideIndex,
    slideTitle,
    slideObjectCount,
    allSlideTitles,
  };
}
