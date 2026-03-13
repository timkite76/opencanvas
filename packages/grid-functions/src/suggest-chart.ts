import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

/**
 * Suggest Chart: Analyzes a data range and recommends the best chart type.
 *
 * Logic:
 *   - If data has categories + one numeric column -> bar chart
 *   - If data is a time series or sequential -> line chart
 *   - If data has a small number of categories that sum to a whole -> pie chart
 *   - Otherwise -> bar chart as default
 *
 * Read-only: returns previewText with the recommendation, no operations for MVP.
 */

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

interface ColumnAnalysis {
  colLabel: string;
  values: (string | number | boolean | null)[];
  numericValues: number[];
  stringValues: string[];
  isNumeric: boolean;
  isCategorial: boolean;
  isSequential: boolean;
  uniqueCount: number;
}

function analyzeColumn(
  artifact: FunctionExecutionContext['artifact'],
  colLabel: string,
  startRow: number,
  endRow: number,
): ColumnAnalysis {
  const values: (string | number | boolean | null)[] = [];
  const numericValues: number[] = [];
  const stringValues: string[] = [];

  for (let row = startRow; row <= endRow; row++) {
    const addr = `${colLabel}${row}`;
    let rawValue: string | number | boolean | null = null;

    for (const node of Object.values(artifact.nodes)) {
      if (
        node.type === 'cell' &&
        typeof node === 'object' &&
        'address' in node
      ) {
        const cellNode = node as Record<string, unknown>;
        if (String(cellNode.address ?? '').toUpperCase() === addr.toUpperCase()) {
          rawValue = cellNode.rawValue as string | number | boolean | null;
          break;
        }
      }
    }

    values.push(rawValue);
    if (rawValue !== null && rawValue !== '') {
      const num = Number(rawValue);
      if (!isNaN(num) && typeof rawValue !== 'boolean') {
        numericValues.push(num);
      } else if (typeof rawValue === 'string') {
        stringValues.push(rawValue);
      }
    }
  }

  const uniqueStrings = new Set(stringValues.map((s) => s.toLowerCase()));
  const isNumeric = numericValues.length > stringValues.length;
  const isCategorial = !isNumeric && uniqueStrings.size <= 20;

  // Check if numeric values form a sequential pattern
  let isSequential = false;
  if (numericValues.length >= 3) {
    let monotonic = true;
    for (let i = 1; i < numericValues.length; i++) {
      if (numericValues[i]! < numericValues[i - 1]!) {
        monotonic = false;
        break;
      }
    }
    isSequential = monotonic;
  }

  // Check for date-like strings
  if (!isSequential && stringValues.length >= 3) {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}/,
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
      /^(q[1-4])/i,
    ];
    const dateMatchCount = stringValues.filter((s) =>
      datePatterns.some((p) => p.test(s)),
    ).length;
    if (dateMatchCount / stringValues.length >= 0.7) {
      isSequential = true;
    }
  }

  return {
    colLabel,
    values,
    numericValues,
    stringValues,
    isNumeric,
    isCategorial,
    isSequential,
    uniqueCount: isNumeric
      ? new Set(numericValues).size
      : uniqueStrings.size,
  };
}

export const suggestChartFunction: RegisteredFunction = {
  name: 'suggest_chart',
  description:
    'Analyze a data range and suggest the best chart type (bar, line, or pie) with reasoning.',
  inputSchema: {
    type: 'object',
    properties: {
      rangeDescription: {
        type: 'string',
        description: 'Range to analyze, e.g. "A1:B10"',
      },
    },
    required: ['rangeDescription'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      chartType: { type: 'string' },
      reasoning: { type: 'string' },
    },
  },
  permissions: {
    scope: 'range',
    mutatesArtifact: false,
    requiresApproval: false,
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

    // Analyze each column
    const columns: ColumnAnalysis[] = [];
    for (let colIdx = startColIdx; colIdx <= endColIdx; colIdx++) {
      columns.push(
        analyzeColumn(context.artifact, columnIndexToLabel(colIdx), startRow, endRow),
      );
    }

    if (columns.length === 0) {
      return {
        proposedOperations: [],
        previewText: 'No data found in the specified range.',
        output: { chartType: 'none', reasoning: 'No data found' },
      };
    }

    const numericCols = columns.filter((c) => c.isNumeric);
    const categorialCols = columns.filter((c) => c.isCategorial);
    const sequentialCols = columns.filter((c) => c.isSequential);

    let chartType: 'bar' | 'line' | 'pie';
    const reasons: string[] = [];

    // Rule 1: If there is a sequential/time column and numeric data -> line chart
    if (sequentialCols.length > 0 && numericCols.length > 0) {
      chartType = 'line';
      reasons.push(
        `Column ${sequentialCols[0]!.colLabel} appears to contain sequential/time-based data.`,
      );
      reasons.push(
        `${numericCols.length} numeric column(s) provide data series.`,
      );
      reasons.push('A line chart is best for showing trends over time or sequences.');
    }
    // Rule 2: If one category column + one numeric column with few categories -> pie chart
    else if (
      categorialCols.length === 1 &&
      numericCols.length === 1 &&
      categorialCols[0]!.uniqueCount <= 8 &&
      numericCols[0]!.numericValues.every((n) => n >= 0)
    ) {
      chartType = 'pie';
      reasons.push(
        `Column ${categorialCols[0]!.colLabel} has ${categorialCols[0]!.uniqueCount} categories.`,
      );
      reasons.push(
        `Column ${numericCols[0]!.colLabel} has all non-negative values.`,
      );
      reasons.push('A pie chart works well for showing proportions with a small number of categories.');
    }
    // Rule 3: Categories + numeric -> bar chart
    else if (categorialCols.length >= 1 && numericCols.length >= 1) {
      chartType = 'bar';
      reasons.push(
        `${categorialCols.length} category column(s) and ${numericCols.length} numeric column(s) found.`,
      );
      reasons.push('A bar chart is ideal for comparing values across categories.');
    }
    // Default: bar chart
    else {
      chartType = 'bar';
      reasons.push(
        `Found ${columns.length} column(s) with ${numericCols.length} numeric and ${categorialCols.length} categorical.`,
      );
      reasons.push('A bar chart is recommended as a versatile default visualization.');
    }

    const lines: string[] = [];
    lines.push(`Chart Suggestion for ${rangeDescription}`);
    lines.push('='.repeat(40));
    lines.push('');
    lines.push(`Recommended chart type: ${chartType.toUpperCase()}`);
    lines.push('');
    lines.push('Reasoning:');
    for (const reason of reasons) {
      lines.push(`  - ${reason}`);
    }
    lines.push('');
    lines.push('Data summary:');
    for (const col of columns) {
      const typeDesc = col.isNumeric
        ? `numeric (${col.numericValues.length} values)`
        : col.isCategorial
          ? `categorical (${col.uniqueCount} unique)`
          : `mixed`;
      lines.push(`  Column ${col.colLabel}: ${typeDesc}${col.isSequential ? ' [sequential]' : ''}`);
    }

    const previewText = lines.join('\n');

    return {
      proposedOperations: [],
      previewText,
      output: { chartType, reasoning: reasons.join(' ') },
    };
  },
};
