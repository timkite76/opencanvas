import { v4 as uuidv4 } from 'uuid';
import type { SetCellValueOperation } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

/**
 * Clean Data: Detects and fixes data quality issues in a range.
 *
 * Fixes:
 *   - Extra whitespace (leading, trailing, multiple internal spaces)
 *   - Inconsistent capitalization (normalizes to Title Case)
 *   - Duplicate values (flags them in previewText)
 *
 * Returns set_cell_value operations for cleaned values.
 */

interface CellInfo {
  id: string;
  address: string;
  rawValue: string | number | boolean | null;
  valueType: string;
}

function columnLabelToIndex(label: string): number {
  const upper = label.toUpperCase();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

function columnIndexToLabel(index: number): string {
  let label = '';
  let remaining = index + 1;
  while (remaining > 0) {
    remaining--;
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }
  return label;
}

function findCellByAddress(
  artifact: FunctionExecutionContext['artifact'],
  address: string,
): CellInfo | null {
  const upper = address.toUpperCase();
  for (const node of Object.values(artifact.nodes)) {
    if (
      node.type === 'cell' &&
      typeof node === 'object' &&
      'address' in node
    ) {
      const cellNode = node as Record<string, unknown>;
      if (String(cellNode.address ?? '').toUpperCase() === upper) {
        return {
          id: node.id,
          address: upper,
          rawValue: cellNode.rawValue as string | number | boolean | null,
          valueType: String(cellNode.valueType ?? 'empty'),
        };
      }
    }
  }
  return null;
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function cleanWhitespace(str: string): string {
  return str.trim().replace(/\s{2,}/g, ' ');
}

/**
 * Detect the dominant capitalization style in a set of strings.
 * Returns a function that normalizes to that style.
 */
function detectCapitalizationStyle(values: string[]): ((str: string) => string) | null {
  let titleCount = 0;
  let upperCount = 0;
  let lowerCount = 0;

  for (const val of values) {
    const trimmed = val.trim();
    if (!trimmed) continue;
    if (trimmed === trimmed.toUpperCase() && /[A-Za-z]/.test(trimmed)) upperCount++;
    else if (trimmed === trimmed.toLowerCase() && /[A-Za-z]/.test(trimmed)) lowerCount++;
    else if (trimmed === toTitleCase(trimmed)) titleCount++;
  }

  const max = Math.max(titleCount, upperCount, lowerCount);
  if (max === 0) return null;

  // If most values follow one style, normalize outliers to that style
  const total = titleCount + upperCount + lowerCount;
  if (total < 3) return null; // Not enough data to determine style

  if (titleCount >= max && titleCount / total >= 0.5) return toTitleCase;
  if (upperCount >= max && upperCount / total >= 0.5) return (s: string) => s.toUpperCase();
  if (lowerCount >= max && lowerCount / total >= 0.5) return (s: string) => s.toLowerCase();

  return null;
}

export const cleanDataFunction: RegisteredFunction = {
  name: 'clean_data',
  description:
    'Clean data in a range: fix extra whitespace, normalize inconsistent capitalization, and flag duplicate values.',
  inputSchema: {
    type: 'object',
    properties: {
      rangeDescription: {
        type: 'string',
        description: 'Range to clean, e.g. "A1:A20" or "B2:D10"',
      },
    },
    required: ['rangeDescription'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      changesCount: { type: 'number' },
      duplicatesFound: { type: 'number' },
      summary: { type: 'string' },
    },
  },
  permissions: {
    scope: 'range',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const rangeDescription = context.parameters.rangeDescription as string;
    if (!rangeDescription) {
      throw new Error('Missing required parameter: rangeDescription');
    }

    const rangeMatch = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(rangeDescription.trim());
    if (!rangeMatch) {
      throw new Error(`Invalid range: "${rangeDescription}"`);
    }

    const startCol = rangeMatch[1]!.toUpperCase();
    const startRow = parseInt(rangeMatch[2]!, 10);
    const endCol = rangeMatch[3]!.toUpperCase();
    const endRow = parseInt(rangeMatch[4]!, 10);

    const startColIdx = columnLabelToIndex(startCol);
    const endColIdx = columnLabelToIndex(endCol);

    // Gather all string cells in the range
    const allCells: CellInfo[] = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let colIdx = startColIdx; colIdx <= endColIdx; colIdx++) {
        const addr = `${columnIndexToLabel(colIdx)}${row}`;
        const cell = findCellByAddress(context.artifact, addr);
        if (cell) {
          allCells.push(cell);
        }
      }
    }

    // Process column by column for capitalization detection
    const operations: SetCellValueOperation[] = [];
    const changeDetails: string[] = [];
    const duplicateDetails: string[] = [];

    for (let colIdx = startColIdx; colIdx <= endColIdx; colIdx++) {
      const colLabel = columnIndexToLabel(colIdx);
      const colCells: CellInfo[] = [];

      for (let row = startRow; row <= endRow; row++) {
        const addr = `${colLabel}${row}`;
        const cell = findCellByAddress(context.artifact, addr);
        if (cell && typeof cell.rawValue === 'string' && cell.rawValue.trim() !== '') {
          colCells.push(cell);
        }
      }

      if (colCells.length === 0) continue;

      // Detect capitalization style for this column
      const stringValues = colCells
        .filter((c) => typeof c.rawValue === 'string')
        .map((c) => c.rawValue as string);
      const normalizeCase = detectCapitalizationStyle(stringValues);

      // Detect duplicates
      const valueCounts = new Map<string, string[]>();
      for (const cell of colCells) {
        if (typeof cell.rawValue === 'string') {
          const normalized = cell.rawValue.trim().toLowerCase();
          const existing = valueCounts.get(normalized) ?? [];
          existing.push(cell.address);
          valueCounts.set(normalized, existing);
        }
      }

      for (const [value, addresses] of valueCounts) {
        if (addresses.length > 1) {
          duplicateDetails.push(
            `"${value}" appears ${addresses.length} times at: ${addresses.join(', ')}`,
          );
        }
      }

      // Apply cleaning
      for (const cell of colCells) {
        if (typeof cell.rawValue !== 'string') continue;

        let cleaned = cell.rawValue;
        const changes: string[] = [];

        // Fix whitespace
        const whitespaceFixed = cleanWhitespace(cleaned);
        if (whitespaceFixed !== cleaned) {
          changes.push('fixed whitespace');
          cleaned = whitespaceFixed;
        }

        // Normalize capitalization
        if (normalizeCase) {
          const caseFixed = normalizeCase(cleaned);
          if (caseFixed !== cleaned) {
            changes.push('normalized capitalization');
            cleaned = caseFixed;
          }
        }

        if (changes.length > 0) {
          changeDetails.push(`${cell.address}: "${cell.rawValue}" -> "${cleaned}" (${changes.join(', ')})`);

          const op: SetCellValueOperation = {
            operationId: uuidv4(),
            type: 'set_cell_value',
            artifactId: context.artifact.artifactId,
            targetId: cell.id,
            actorType: 'agent',
            actorId: 'grid-clean-data-agent',
            timestamp: new Date().toISOString(),
            payload: {
              rawValue: cleaned,
              previousRawValue: cell.rawValue,
            },
          };
          operations.push(op);
        }
      }
    }

    const lines: string[] = [];
    lines.push('Data Cleaning Report');
    lines.push('='.repeat(40));

    if (changeDetails.length > 0) {
      lines.push(`\nChanges (${changeDetails.length}):`);
      for (const detail of changeDetails) {
        lines.push(`  ${detail}`);
      }
    } else {
      lines.push('\nNo whitespace or capitalization issues found.');
    }

    if (duplicateDetails.length > 0) {
      lines.push(`\nDuplicates detected (${duplicateDetails.length}):`);
      for (const detail of duplicateDetails) {
        lines.push(`  ${detail}`);
      }
    }

    const previewText = lines.join('\n');

    return {
      proposedOperations: operations,
      previewText,
      output: {
        changesCount: operations.length,
        duplicatesFound: duplicateDetails.length,
        summary: `${operations.length} cells cleaned, ${duplicateDetails.length} duplicate groups found`,
      },
    };
  },
};
