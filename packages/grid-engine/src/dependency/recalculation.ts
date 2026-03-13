import type { ObjectID } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode, CellNode, WorksheetNode } from '@opencanvas/grid-model';
import { expandRange } from '../utils/ranges.js';
import { makeCellKey } from '../utils/cell-keys.js';
import { parseFormula } from '../parser/formula-parser.js';
import { evaluateFormulaAst } from '../evaluator/evaluator.js';
import type { EvaluatedScalar, EvaluationContext } from '../evaluator/types.js';
import {
  type DependencyGraph,
  createEmptyDependencyGraph,
  extractDependencies,
  setDependencies,
  getDependents,
} from './dependency-graph.js';

interface WorksheetCells {
  worksheetId: ObjectID;
  cellsByAddress: Map<string, CellNode>;
}

/**
 * Build a lookup of cells by address for a specific worksheet.
 */
function buildCellMap(
  artifact: ArtifactEnvelope<GridNode>,
  worksheetId: ObjectID,
): Map<string, CellNode> {
  const map = new Map<string, CellNode>();
  for (const node of Object.values(artifact.nodes)) {
    if (node.type === 'cell' && node.parentId === worksheetId) {
      const cell = node as CellNode;
      map.set(cell.address.toUpperCase(), cell);
    }
  }
  return map;
}

function resolveDisplayValue(val: EvaluatedScalar): string {
  if (val === null) return '';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return val;
}

function resolveValueType(val: EvaluatedScalar): CellNode['valueType'] {
  if (val === null) return 'empty';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'string' && val.startsWith('#')) return 'error';
  return 'string';
}

function createEvaluationContext(cellMap: Map<string, CellNode>): EvaluationContext {
  return {
    getCellValue: (address: string): EvaluatedScalar => {
      const cell = cellMap.get(address.toUpperCase());
      if (!cell) return null;
      // If the cell has a formula, use the displayValue (already computed)
      if (cell.formula) {
        const dv = cell.displayValue;
        if (dv === '') return null;
        const num = Number(dv);
        if (!isNaN(num) && dv !== '') return num;
        if (dv === 'TRUE') return true;
        if (dv === 'FALSE') return false;
        return dv;
      }
      return cell.rawValue;
    },
    getRangeValues: (range: string): EvaluatedScalar[] => {
      const addresses = expandRange(range);
      return addresses.map((addr) => {
        const cell = cellMap.get(addr.toUpperCase());
        if (!cell) return null;
        if (cell.formula) {
          const dv = cell.displayValue;
          if (dv === '') return null;
          const num = Number(dv);
          if (!isNaN(num) && dv !== '') return num;
          if (dv === 'TRUE') return true;
          if (dv === 'FALSE') return false;
          return dv;
        }
        return cell.rawValue;
      });
    },
  };
}

/**
 * Evaluate a single cell and update its displayValue and valueType in the artifact.
 * Returns the new display value.
 */
function evaluateCell(
  artifact: ArtifactEnvelope<GridNode>,
  cell: CellNode,
  cellMap: Map<string, CellNode>,
): void {
  if (!cell.formula) {
    // Non-formula cell: displayValue is just stringified rawValue
    const dv = cell.rawValue === null ? '' : String(cell.rawValue);
    const vt = resolveValueType(cell.rawValue);
    const updated: CellNode = { ...cell, displayValue: dv, valueType: vt };
    (artifact.nodes as Record<string, GridNode>)[cell.id] = updated;
    cellMap.set(cell.address.toUpperCase(), updated);
    return;
  }

  const ctx = createEvaluationContext(cellMap);
  try {
    const ast = parseFormula(cell.formula);
    const result = evaluateFormulaAst(ast, ctx);
    const scalar: EvaluatedScalar = Array.isArray(result) ? result[0] ?? null : result;
    const dv = resolveDisplayValue(scalar);
    const vt = resolveValueType(scalar);
    const updated: CellNode = { ...cell, displayValue: dv, valueType: vt };
    (artifact.nodes as Record<string, GridNode>)[cell.id] = updated;
    cellMap.set(cell.address.toUpperCase(), updated);
  } catch {
    const updated: CellNode = { ...cell, displayValue: '#ERROR!', valueType: 'error' };
    (artifact.nodes as Record<string, GridNode>)[cell.id] = updated;
    cellMap.set(cell.address.toUpperCase(), updated);
  }
}

/**
 * Recalculate all cells that depend on a changed cell (identified by address),
 * within a given worksheet. Modifies the artifact in place.
 */
export function recalculateFromCell(
  artifact: ArtifactEnvelope<GridNode>,
  worksheetId: ObjectID,
  changedAddress: string,
): void {
  const cellMap = buildCellMap(artifact, worksheetId);
  const graph = buildDependencyGraphForWorksheet(cellMap);

  // First, evaluate the changed cell itself
  const changedCell = cellMap.get(changedAddress.toUpperCase());
  if (changedCell) {
    evaluateCell(artifact, changedCell, cellMap);
  }

  // Then evaluate all dependents in order
  const dependents = getDependents(graph, changedAddress);
  for (const depAddr of dependents) {
    const depCell = cellMap.get(depAddr);
    if (depCell) {
      evaluateCell(artifact, depCell, cellMap);
    }
  }
}

/**
 * Recalculate ALL formula cells in ALL worksheets. Useful for initial load.
 * Modifies the artifact in place.
 */
export function recalculateAllFormulas(
  artifact: ArtifactEnvelope<GridNode>,
): void {
  // Find all worksheets
  const worksheetIds: ObjectID[] = [];
  for (const node of Object.values(artifact.nodes)) {
    if (node.type === 'worksheet') {
      worksheetIds.push(node.id);
    }
  }

  for (const wsId of worksheetIds) {
    const cellMap = buildCellMap(artifact, wsId);
    const graph = buildDependencyGraphForWorksheet(cellMap);

    // Topological sort: evaluate cells without formula deps first, then formula cells
    const formulaCells: CellNode[] = [];
    const nonFormulaCells: CellNode[] = [];

    for (const cell of cellMap.values()) {
      if (cell.formula) {
        formulaCells.push(cell);
      } else {
        nonFormulaCells.push(cell);
      }
    }

    // Evaluate non-formula cells first
    for (const cell of nonFormulaCells) {
      evaluateCell(artifact, cell, cellMap);
    }

    // Simple iterative evaluation for formula cells (handles dependencies)
    // In a production system we would do a proper topological sort.
    // For MVP, iterate up to N times until stable.
    const maxPasses = formulaCells.length + 1;
    for (let pass = 0; pass < maxPasses; pass++) {
      let changed = false;
      for (const cell of formulaCells) {
        const currentCell = cellMap.get(cell.address.toUpperCase())!;
        const oldDisplay = currentCell.displayValue;
        evaluateCell(artifact, currentCell, cellMap);
        const newCell = cellMap.get(cell.address.toUpperCase())!;
        if (newCell.displayValue !== oldDisplay) {
          changed = true;
        }
      }
      if (!changed) break;
    }
  }
}

function buildDependencyGraphForWorksheet(
  cellMap: Map<string, CellNode>,
): DependencyGraph {
  const graph = createEmptyDependencyGraph();
  for (const cell of cellMap.values()) {
    if (cell.formula) {
      try {
        const ast = parseFormula(cell.formula);
        const deps = extractDependencies(ast);
        setDependencies(graph, cell.address, deps);
      } catch {
        // Skip cells with unparseable formulas
      }
    }
  }
  return graph;
}
