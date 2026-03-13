import { v4 as uuidv4 } from 'uuid';
import type { SetCellValueOperation } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

/**
 * Smart Fill: Detects patterns in existing cell values and fills target cells.
 *
 * MVP pattern detection:
 *   - Numeric sequences (1, 2, 3 -> 4, 5, 6)
 *   - Text patterns with numbers ("Item 1", "Item 2" -> "Item 3")
 *   - Day names (Monday, Tuesday -> Wednesday)
 *   - Month names (January, February -> March)
 *   - Email pattern: if column header is "Email" and adjacent column has names
 */

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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

function findInCyclicList(list: string[], value: string): number {
  const lower = value.toLowerCase();
  return list.findIndex((item) => item.toLowerCase() === lower);
}

interface DetectedPattern {
  type: 'numeric_sequence' | 'text_with_number' | 'day_name' | 'month_name' | 'email';
  generateNext: (index: number) => string | number;
  description: string;
}

function detectPattern(values: (string | number | boolean | null)[]): DetectedPattern | null {
  // Filter out nulls/empty
  const nonEmpty = values.filter(
    (v): v is string | number => v !== null && v !== '' && v !== undefined,
  );
  if (nonEmpty.length < 2) return null;

  // Check numeric sequence
  const nums = nonEmpty.map(Number);
  if (nums.every((n) => !isNaN(n))) {
    // Check for constant difference (arithmetic sequence)
    const diffs: number[] = [];
    for (let i = 1; i < nums.length; i++) {
      diffs.push(nums[i]! - nums[i - 1]!);
    }
    const allSameDiff = diffs.every((d) => Math.abs(d - diffs[0]!) < 1e-10);
    if (allSameDiff && diffs.length > 0) {
      const step = diffs[0]!;
      const lastVal = nums[nums.length - 1]!;
      return {
        type: 'numeric_sequence',
        generateNext: (index: number) => lastVal + step * (index + 1),
        description: `Numeric sequence with step ${step}`,
      };
    }
  }

  // All values are strings from here
  const strValues = nonEmpty.map(String);

  // Check day names
  const dayIndices = strValues.map((v) => findInCyclicList(DAYS, v));
  if (dayIndices.every((idx) => idx >= 0)) {
    const useShort = strValues.some(
      (v) => DAYS_SHORT.some((d) => d.toLowerCase() === v.toLowerCase()),
    );
    const list = useShort ? DAYS_SHORT : DAYS;
    const lastIdx = dayIndices[dayIndices.length - 1]!;
    return {
      type: 'day_name',
      generateNext: (index: number) => list[(lastIdx + index + 1) % 7]!,
      description: 'Day name sequence',
    };
  }

  // Check short day names
  const dayShortIndices = strValues.map((v) => findInCyclicList(DAYS_SHORT, v));
  if (dayShortIndices.every((idx) => idx >= 0)) {
    const lastIdx = dayShortIndices[dayShortIndices.length - 1]!;
    return {
      type: 'day_name',
      generateNext: (index: number) => DAYS_SHORT[(lastIdx + index + 1) % 7]!,
      description: 'Day name sequence (abbreviated)',
    };
  }

  // Check month names
  const monthIndices = strValues.map((v) => findInCyclicList(MONTHS, v));
  if (monthIndices.every((idx) => idx >= 0)) {
    const lastIdx = monthIndices[monthIndices.length - 1]!;
    return {
      type: 'month_name',
      generateNext: (index: number) => MONTHS[(lastIdx + index + 1) % 12]!,
      description: 'Month name sequence',
    };
  }

  // Check short month names
  const monthShortIndices = strValues.map((v) => findInCyclicList(MONTHS_SHORT, v));
  if (monthShortIndices.every((idx) => idx >= 0)) {
    const lastIdx = monthShortIndices[monthShortIndices.length - 1]!;
    return {
      type: 'month_name',
      generateNext: (index: number) => MONTHS_SHORT[(lastIdx + index + 1) % 12]!,
      description: 'Month name sequence (abbreviated)',
    };
  }

  // Check text with trailing number pattern: "Item 1", "Item 2" -> "Item 3"
  const textNumberPattern = /^(.+?)(\d+)$/;
  const parsed = strValues.map((v) => textNumberPattern.exec(v));
  if (parsed.every((m) => m !== null)) {
    const prefixes = parsed.map((m) => m![1]!);
    const numbers = parsed.map((m) => parseInt(m![2]!, 10));

    // Check if all prefixes are the same and numbers form a sequence
    const allSamePrefix = prefixes.every((p) => p === prefixes[0]);
    if (allSamePrefix && numbers.length >= 2) {
      const numDiffs: number[] = [];
      for (let i = 1; i < numbers.length; i++) {
        numDiffs.push(numbers[i]! - numbers[i - 1]!);
      }
      const allSameStep = numDiffs.every((d) => d === numDiffs[0]);
      if (allSameStep && numDiffs.length > 0) {
        const step = numDiffs[0]!;
        const lastNum = numbers[numbers.length - 1]!;
        const prefix = prefixes[0]!;
        return {
          type: 'text_with_number',
          generateNext: (index: number) => `${prefix}${lastNum + step * (index + 1)}`,
          description: `Text pattern "${prefix}N" with step ${step}`,
        };
      }
    }
  }

  return null;
}

export const smartFillFunction: RegisteredFunction = {
  name: 'smart_fill',
  description:
    'Detect patterns in existing cell values and fill target cells with predicted values. Supports numeric sequences, text patterns, day names, and month names.',
  inputSchema: {
    type: 'object',
    properties: {
      sourceRange: {
        type: 'string',
        description: 'Range of cells with existing values, e.g. "A1:A5"',
      },
      targetRange: {
        type: 'string',
        description: 'Range of cells to fill, e.g. "A6:A10"',
      },
    },
    required: ['sourceRange', 'targetRange'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
      filledCount: { type: 'number' },
    },
  },
  permissions: {
    scope: 'range',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const sourceRange = context.parameters.sourceRange as string;
    const targetRange = context.parameters.targetRange as string;

    if (!sourceRange || !targetRange) {
      throw new Error('Missing required parameters: sourceRange and targetRange');
    }

    // Parse source range
    const srcMatch = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(sourceRange.trim());
    if (!srcMatch) {
      throw new Error(`Invalid source range: "${sourceRange}"`);
    }

    const srcStartCol = srcMatch[1]!.toUpperCase();
    const srcStartRow = parseInt(srcMatch[2]!, 10);
    const srcEndCol = srcMatch[3]!.toUpperCase();
    const srcEndRow = parseInt(srcMatch[4]!, 10);

    // Parse target range
    const tgtMatch = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(targetRange.trim());
    if (!tgtMatch) {
      throw new Error(`Invalid target range: "${targetRange}"`);
    }

    const tgtStartCol = tgtMatch[1]!.toUpperCase();
    const tgtStartRow = parseInt(tgtMatch[2]!, 10);
    const tgtEndCol = tgtMatch[3]!.toUpperCase();
    const tgtEndRow = parseInt(tgtMatch[4]!, 10);

    const srcStartColIdx = columnLabelToIndex(srcStartCol);
    const srcEndColIdx = columnLabelToIndex(srcEndCol);
    const tgtStartColIdx = columnLabelToIndex(tgtStartCol);
    const tgtEndColIdx = columnLabelToIndex(tgtEndCol);

    const operations: SetCellValueOperation[] = [];
    const previews: string[] = [];

    // For each column in the range, detect pattern and fill
    const numCols = Math.min(srcEndColIdx - srcStartColIdx + 1, tgtEndColIdx - tgtStartColIdx + 1);

    for (let colOffset = 0; colOffset < numCols; colOffset++) {
      const srcColIdx = srcStartColIdx + colOffset;
      const tgtColIdx = tgtStartColIdx + colOffset;
      const colLabel = columnIndexToLabel(srcColIdx);

      // Gather source values
      const sourceValues: (string | number | boolean | null)[] = [];
      for (let row = srcStartRow; row <= srcEndRow; row++) {
        const addr = `${colLabel}${row}`;
        const cell = findCellByAddress(context.artifact, addr);
        sourceValues.push(cell?.rawValue ?? null);
      }

      let pattern: DetectedPattern | null = null;

      if (context.callLlm) {
        // Real LLM call to predict values
        const nonEmpty = sourceValues.filter((v) => v !== null && v !== '');
        if (nonEmpty.length >= 2) {
          const valuesStr = nonEmpty.map(String).join(', ');
          const targetCount = tgtEndRow - tgtStartRow + 1;

          const systemPrompt = 'You are a data assistant. Based on the pattern in the provided data, predict the next values. Return ONLY the values, one per line.';
          const userPrompt = `Given these values in order: ${valuesStr}\n\nPredict the next ${targetCount} values:`;

          try {
            const response = await context.callLlm({ systemPrompt, userPrompt });
            const predictedValues = response
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(0, targetCount);

            if (predictedValues.length > 0) {
              pattern = {
                type: 'text_with_number',
                generateNext: (index: number) => predictedValues[index] ?? '',
                description: `LLM-predicted pattern from [${valuesStr}]`,
              };
            }
          } catch (error) {
            // Fall through to deterministic pattern detection
          }
        }
      }

      if (!pattern) {
        // Check for email pattern: header says "Email" and we have a name column
        const headerCell = findCellByAddress(context.artifact, `${columnIndexToLabel(tgtColIdx)}1`);
        const headerValue = headerCell?.rawValue;
        const isEmailCol =
          typeof headerValue === 'string' &&
          headerValue.toLowerCase().includes('email');

        if (isEmailCol) {
          // Look for a name column to the left
          const nameColIdx = tgtColIdx > 0 ? tgtColIdx - 1 : -1;
          if (nameColIdx >= 0) {
            pattern = {
              type: 'email',
              generateNext: (index: number) => {
                const nameAddr = `${columnIndexToLabel(nameColIdx)}${tgtStartRow + index}`;
                const nameCell = findCellByAddress(context.artifact, nameAddr);
                if (nameCell?.rawValue && typeof nameCell.rawValue === 'string') {
                  const name = nameCell.rawValue.trim().toLowerCase();
                  const parts = name.split(/\s+/);
                  if (parts.length >= 2) {
                    return `${parts[0]}.${parts[parts.length - 1]}@company.com`;
                  }
                  return `${parts[0]}@company.com`;
                }
                return '';
              },
              description: 'Email pattern from adjacent name column',
            };
          }
        }
      }

      if (!pattern) {
        pattern = detectPattern(sourceValues);
      }

      if (!pattern) {
        previews.push(`Column ${colLabel}: No pattern detected`);
        continue;
      }

      previews.push(`Column ${columnIndexToLabel(tgtColIdx)}: ${pattern.description}`);

      // Generate values for target cells
      for (let row = tgtStartRow; row <= tgtEndRow; row++) {
        const fillIndex = row - tgtStartRow;
        const targetAddr = `${columnIndexToLabel(tgtColIdx)}${row}`;
        const targetCell = findCellByAddress(context.artifact, targetAddr);

        if (!targetCell) continue;

        const newValue = pattern.generateNext(fillIndex);

        const op: SetCellValueOperation = {
          operationId: uuidv4(),
          type: 'set_cell_value',
          artifactId: context.artifact.artifactId,
          targetId: targetCell.id,
          actorType: 'agent',
          actorId: 'grid-smart-fill-agent',
          timestamp: new Date().toISOString(),
          payload: {
            rawValue: typeof newValue === 'number' ? newValue : String(newValue),
            previousRawValue: targetCell.rawValue,
          },
        };
        operations.push(op);
      }
    }

    const previewText = previews.length > 0
      ? `Smart Fill Preview:\n${previews.join('\n')}\n\n${operations.length} cell(s) will be updated.`
      : 'No patterns detected in the source data.';

    return {
      proposedOperations: operations,
      previewText,
      output: {
        pattern: previews.join('; '),
        filledCount: operations.length,
      },
    };
  },
};
