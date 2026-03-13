import { parseCellAddress, columnIndexToLabel, type ParsedCellAddress } from './addresses.js';

export interface ParsedRange {
  start: ParsedCellAddress;
  end: ParsedCellAddress;
}

/**
 * Parse a range string like "A1:B10" into start/end addresses.
 */
export function parseRange(range: string): ParsedRange {
  const parts = range.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid range: "${range}" -- expected format "A1:B10"`);
  }
  return {
    start: parseCellAddress(parts[0]!.trim()),
    end: parseCellAddress(parts[1]!.trim()),
  };
}

/**
 * Expand a range string like "A1:B3" into an array of cell address strings.
 * Returns addresses in row-major order: ["A1","B1","A2","B2","A3","B3"]
 */
export function expandRange(range: string): string[] {
  const { start, end } = parseRange(range);
  const minCol = Math.min(start.columnIndex, end.columnIndex);
  const maxCol = Math.max(start.columnIndex, end.columnIndex);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  const addresses: string[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      addresses.push(`${columnIndexToLabel(col)}${row}`);
    }
  }
  return addresses;
}
