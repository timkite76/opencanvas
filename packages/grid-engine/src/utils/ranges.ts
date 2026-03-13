import { expandRange as gridModelExpandRange } from '@opencanvas/grid-model';

/**
 * Re-export expandRange from grid-model for convenience within grid-engine.
 */
export function expandRange(range: string): string[] {
  return gridModelExpandRange(range);
}
