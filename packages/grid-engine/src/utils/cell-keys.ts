import type { ObjectID } from '@opencanvas/core-types';

/**
 * Create a unique key for a cell within a worksheet, suitable for use as a map key.
 */
export function makeCellKey(worksheetId: ObjectID, address: string): string {
  return `${worksheetId}::${address.toUpperCase()}`;
}
