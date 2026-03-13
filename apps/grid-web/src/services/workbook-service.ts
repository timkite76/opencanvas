import { v4 as uuidv4 } from 'uuid';
import type { Operation, SetCellValueOperation, SetFormulaOperation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode, CellNode } from '@opencanvas/grid-model';
import {
  applyGridOperationWithRecalc,
  initializeWorkbookComputedValues,
} from '@opencanvas/grid-engine';
import { SAMPLE_WORKBOOK } from '../sample-data/sample-workbook.js';

export interface WorkbookService {
  open(): ArtifactEnvelope<GridNode>;
  save(artifact: ArtifactEnvelope<GridNode>): void;
  applyCellValueChange(
    artifact: ArtifactEnvelope<GridNode>,
    cellId: string,
    newValue: string | number | boolean | null,
  ): ArtifactEnvelope<GridNode>;
  applyFormulaChange(
    artifact: ArtifactEnvelope<GridNode>,
    cellId: string,
    formula: string,
  ): ArtifactEnvelope<GridNode>;
  applyOp(
    artifact: ArtifactEnvelope<GridNode>,
    op: Operation,
  ): ArtifactEnvelope<GridNode>;
}

export function createWorkbookService(): WorkbookService {
  return {
    open(): ArtifactEnvelope<GridNode> {
      // Load sample data and compute initial formula values
      return initializeWorkbookComputedValues(SAMPLE_WORKBOOK);
    },

    save(artifact: ArtifactEnvelope<GridNode>): void {
      // MVP: log to console. In production, serialize to .ocg file.
      console.log('[workbook-service] save', {
        artifactId: artifact.artifactId,
        nodeCount: Object.keys(artifact.nodes).length,
      });
    },

    applyCellValueChange(
      artifact: ArtifactEnvelope<GridNode>,
      cellId: string,
      newValue: string | number | boolean | null,
    ): ArtifactEnvelope<GridNode> {
      const node = artifact.nodes[cellId] as CellNode | undefined;
      const previousRawValue = node?.rawValue ?? null;

      const op: SetCellValueOperation = {
        operationId: uuidv4(),
        type: 'set_cell_value',
        artifactId: artifact.artifactId,
        targetId: cellId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: {
          rawValue: newValue,
          previousRawValue,
        },
      };

      return applyGridOperationWithRecalc(artifact, op);
    },

    applyFormulaChange(
      artifact: ArtifactEnvelope<GridNode>,
      cellId: string,
      formula: string,
    ): ArtifactEnvelope<GridNode> {
      const node = artifact.nodes[cellId] as CellNode | undefined;
      const previousFormula = node?.formula ?? undefined;

      const op: SetFormulaOperation = {
        operationId: uuidv4(),
        type: 'set_formula',
        artifactId: artifact.artifactId,
        targetId: cellId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: {
          formula,
          previousFormula,
        },
      };

      return applyGridOperationWithRecalc(artifact, op);
    },

    applyOp(
      artifact: ArtifactEnvelope<GridNode>,
      op: Operation,
    ): ArtifactEnvelope<GridNode> {
      return applyGridOperationWithRecalc(artifact, op);
    },
  };
}
