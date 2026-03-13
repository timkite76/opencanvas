import type { ObjectID } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode, WorksheetNode, CellNode } from './types.js';

/**
 * An index over the workbook's flat node map for fast lookups.
 */
export interface WorkbookIndex {
  worksheetById: Map<ObjectID, WorksheetNode>;
  worksheetByName: Map<string, WorksheetNode>;
  /** Key: `${worksheetId}::${address}` */
  cellsByWorksheetAndAddress: Map<string, CellNode>;
}

function makeCellLookupKey(worksheetId: ObjectID, address: string): string {
  return `${worksheetId}::${address.toUpperCase()}`;
}

/**
 * Build a WorkbookIndex from a workbook ArtifactEnvelope.
 * Iterates all nodes once to populate the lookup maps.
 */
export function buildWorkbookIndex(
  artifact: ArtifactEnvelope<GridNode>,
): WorkbookIndex {
  const worksheetById = new Map<ObjectID, WorksheetNode>();
  const worksheetByName = new Map<string, WorksheetNode>();
  const cellsByWorksheetAndAddress = new Map<string, CellNode>();

  for (const node of Object.values(artifact.nodes)) {
    switch (node.type) {
      case 'worksheet': {
        const ws = node as WorksheetNode;
        worksheetById.set(ws.id, ws);
        worksheetByName.set(ws.name, ws);
        break;
      }
      case 'cell': {
        const cell = node as CellNode;
        if (cell.parentId) {
          const key = makeCellLookupKey(cell.parentId, cell.address);
          cellsByWorksheetAndAddress.set(key, cell);
        }
        break;
      }
      default:
        break;
    }
  }

  return { worksheetById, worksheetByName, cellsByWorksheetAndAddress };
}

export { makeCellLookupKey };
