import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode, CellNode } from '@opencanvas/grid-model';
import { applyOperation } from '@opencanvas/core-ops';
import { recalculateFromCell, recalculateAllFormulas } from './dependency/recalculation.js';

/**
 * Apply a single operation to a grid workbook artifact, then trigger
 * formula recalculation for any affected cells.
 *
 * Returns a new artifact (the core applyOperation is immutable, but
 * recalculation mutates the cloned artifact for performance).
 */
export function applyGridOperationWithRecalc(
  artifact: ArtifactEnvelope<GridNode>,
  op: Operation,
): ArtifactEnvelope<GridNode> {
  // Apply the core operation (immutable clone)
  const next = applyOperation(
    artifact as ArtifactEnvelope,
    op,
  ) as ArtifactEnvelope<GridNode>;

  // If the operation targets a cell, recalculate dependents
  if (op.type === 'set_cell_value' || op.type === 'set_formula' || op.type === 'update_node') {
    const targetNode = next.nodes[op.targetId];
    if (targetNode && targetNode.type === 'cell') {
      const cell = targetNode as CellNode;
      if (cell.parentId) {
        recalculateFromCell(next, cell.parentId, cell.address);
      }
    }
  }

  // For batch operations or insert_node, do a full recalc
  if (op.type === 'batch' || op.type === 'insert_node') {
    recalculateAllFormulas(next);
  }

  return next;
}

/**
 * Initialize all computed values (displayValue, valueType) for every cell
 * in the workbook. Call this once after loading a workbook from disk.
 */
export function initializeWorkbookComputedValues(
  artifact: ArtifactEnvelope<GridNode>,
): ArtifactEnvelope<GridNode> {
  // Clone the artifact to avoid mutating the input
  const cloned: ArtifactEnvelope<GridNode> = {
    ...artifact,
    nodes: Object.fromEntries(
      Object.entries(artifact.nodes).map(([k, v]) => [k, { ...v }]),
    ) as Record<string, GridNode>,
    version: { ...artifact.version },
  };

  recalculateAllFormulas(cloned);
  return cloned;
}
