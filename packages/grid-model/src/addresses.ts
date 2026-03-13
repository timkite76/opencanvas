/**
 * Cell address parsing and column label utilities.
 *
 * Addresses follow the standard spreadsheet convention: column letters + row number.
 * Examples: A1, B12, AA100, ZZ999
 */

export interface ParsedCellAddress {
  column: string; // e.g. "A", "AB"
  row: number; // 1-based
  columnIndex: number; // 0-based
  rowIndex: number; // 0-based
}

const CELL_ADDRESS_RE = /^([A-Z]+)(\d+)$/;

/**
 * Parse a cell address string like "A1" or "AB12" into its parts.
 */
export function parseCellAddress(address: string): ParsedCellAddress {
  const upper = address.toUpperCase().trim();
  const match = CELL_ADDRESS_RE.exec(upper);
  if (!match) {
    throw new Error(`Invalid cell address: "${address}"`);
  }
  const column = match[1]!;
  const row = parseInt(match[2]!, 10);
  if (row < 1) {
    throw new Error(`Invalid row number in address: "${address}"`);
  }
  return {
    column,
    row,
    columnIndex: columnLabelToIndex(column),
    rowIndex: row - 1,
  };
}

/**
 * Convert a column label like "A" (0), "B" (1), "Z" (25), "AA" (26) to a 0-based index.
 */
export function columnLabelToIndex(label: string): number {
  const upper = label.toUpperCase();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64); // A=1 .. Z=26
  }
  return index - 1; // convert to 0-based
}

/**
 * Convert a 0-based column index to a column label. 0 -> "A", 25 -> "Z", 26 -> "AA".
 */
export function columnIndexToLabel(index: number): string {
  if (index < 0) {
    throw new Error(`Column index must be >= 0, got ${index}`);
  }
  let label = '';
  let remaining = index + 1; // 1-based for the math
  while (remaining > 0) {
    remaining--; // adjust so A=0 in each position
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }
  return label;
}
