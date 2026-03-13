import type { FormulaAstNode } from '../parser/ast.js';
import { expandRange } from '../utils/ranges.js';

/**
 * A dependency graph mapping cell addresses to the cells they depend on.
 *
 * - `dependsOn`:  cell -> set of cells it reads from
 * - `dependedBy`: cell -> set of cells that read from it (reverse index)
 */
export interface DependencyGraph {
  /** Forward edges: "A1 depends on B1, C1" */
  dependsOn: Map<string, Set<string>>;
  /** Reverse edges: "B1 is depended on by A1" */
  dependedBy: Map<string, Set<string>>;
}

export function createEmptyDependencyGraph(): DependencyGraph {
  return {
    dependsOn: new Map(),
    dependedBy: new Map(),
  };
}

/**
 * Extract all cell address dependencies from a parsed formula AST.
 */
export function extractDependencies(ast: FormulaAstNode): string[] {
  const deps: string[] = [];

  function walk(node: FormulaAstNode): void {
    switch (node.kind) {
      case 'CellReference':
        deps.push(node.address.toUpperCase());
        break;
      case 'RangeReference':
        deps.push(...expandRange(node.range));
        break;
      case 'BinaryExpression':
        walk(node.left);
        walk(node.right);
        break;
      case 'FunctionCall':
        for (const arg of node.args) walk(arg);
        break;
      default:
        break;
    }
  }

  walk(ast);
  return deps;
}

/**
 * Register the dependencies for a cell in the graph.
 * Replaces any previous dependencies for the given cell.
 */
export function setDependencies(
  graph: DependencyGraph,
  cellAddress: string,
  dependencies: string[],
): void {
  const addr = cellAddress.toUpperCase();

  // Remove old reverse edges
  const oldDeps = graph.dependsOn.get(addr);
  if (oldDeps) {
    for (const dep of oldDeps) {
      graph.dependedBy.get(dep)?.delete(addr);
    }
  }

  // Set forward edges
  const depSet = new Set(dependencies.map((d) => d.toUpperCase()));
  graph.dependsOn.set(addr, depSet);

  // Set reverse edges
  for (const dep of depSet) {
    if (!graph.dependedBy.has(dep)) {
      graph.dependedBy.set(dep, new Set());
    }
    graph.dependedBy.get(dep)!.add(addr);
  }
}

/**
 * Get all cells that need recalculation when a given cell changes,
 * in topological order (breadth-first from the changed cell).
 */
export function getDependents(
  graph: DependencyGraph,
  cellAddress: string,
): string[] {
  const addr = cellAddress.toUpperCase();
  const visited = new Set<string>();
  const result: string[] = [];
  const queue = [addr];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = graph.dependedBy.get(current);
    if (!dependents) continue;
    for (const dep of dependents) {
      if (!visited.has(dep)) {
        visited.add(dep);
        result.push(dep);
        queue.push(dep);
      }
    }
  }

  return result;
}
