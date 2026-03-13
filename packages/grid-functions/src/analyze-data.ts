import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

/**
 * Analyze data in a given range of cells.
 * Scans cells in the artifact, computes statistics, identifies trends and outliers.
 * Read-only: returns previewText with analysis, no operations.
 */

interface CellData {
  address: string;
  rawValue: string | number | boolean | null;
  displayValue: string;
  valueType: string;
}

function extractCellsFromRange(
  artifact: FunctionExecutionContext['artifact'],
  rangeDescription: string,
): CellData[] {
  const cells: CellData[] = [];

  // Parse range like "A1:A10" or "B2:D5" or a column like "A"
  const rangeMatch = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(rangeDescription.trim());
  const colOnlyMatch = /^([A-Z]+)$/i.exec(rangeDescription.trim());

  if (rangeMatch) {
    const startCol = rangeMatch[1]!.toUpperCase();
    const startRow = parseInt(rangeMatch[2]!, 10);
    const endCol = rangeMatch[3]!.toUpperCase();
    const endRow = parseInt(rangeMatch[4]!, 10);

    const startColIdx = columnLabelToIndex(startCol);
    const endColIdx = columnLabelToIndex(endCol);

    for (let row = startRow; row <= endRow; row++) {
      for (let colIdx = startColIdx; colIdx <= endColIdx; colIdx++) {
        const colLabel = columnIndexToLabel(colIdx);
        const address = `${colLabel}${row}`;
        const cell = findCellByAddress(artifact, address);
        if (cell) {
          cells.push(cell);
        }
      }
    }
  } else if (colOnlyMatch) {
    // Scan all cells in the column
    const colLabel = colOnlyMatch[1]!.toUpperCase();
    for (const node of Object.values(artifact.nodes)) {
      if (
        node.type === 'cell' &&
        typeof node === 'object' &&
        'address' in node
      ) {
        const cellNode = node as Record<string, unknown>;
        const addr = String(cellNode.address ?? '').toUpperCase();
        if (addr.startsWith(colLabel) && /^\d+$/.test(addr.slice(colLabel.length))) {
          cells.push({
            address: addr,
            rawValue: cellNode.rawValue as string | number | boolean | null,
            displayValue: String(cellNode.displayValue ?? ''),
            valueType: String(cellNode.valueType ?? 'empty'),
          });
        }
      }
    }
  }

  return cells;
}

function findCellByAddress(
  artifact: FunctionExecutionContext['artifact'],
  address: string,
): CellData | null {
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
          address: upper,
          rawValue: cellNode.rawValue as string | number | boolean | null,
          displayValue: String(cellNode.displayValue ?? ''),
          valueType: String(cellNode.valueType ?? 'empty'),
        };
      }
    }
  }
  return null;
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

function computeStandardDeviation(numbers: number[], mean: number): number {
  if (numbers.length < 2) return 0;
  const squaredDiffs = numbers.map((n) => (n - mean) ** 2);
  const variance = squaredDiffs.reduce((acc, v) => acc + v, 0) / numbers.length;
  return Math.sqrt(variance);
}

function detectTrend(numbers: number[]): 'increasing' | 'decreasing' | 'no clear trend' {
  if (numbers.length < 3) return 'no clear trend';

  let increasing = 0;
  let decreasing = 0;
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i]! > numbers[i - 1]!) increasing++;
    else if (numbers[i]! < numbers[i - 1]!) decreasing++;
  }

  const total = numbers.length - 1;
  if (increasing / total >= 0.7) return 'increasing';
  if (decreasing / total >= 0.7) return 'decreasing';
  return 'no clear trend';
}

function detectOutliers(numbers: number[], mean: number, stdDev: number): number[] {
  if (stdDev === 0) return [];
  return numbers.filter((n) => Math.abs(n - mean) > 2 * stdDev);
}

export const analyzeDataFunction: RegisteredFunction = {
  name: 'analyze_data',
  description:
    'Analyze data in a range of cells. Returns statistics including count, sum, average, min, max, standard deviation, trend direction, and outlier detection.',
  inputSchema: {
    type: 'object',
    properties: {
      rangeDescription: {
        type: 'string',
        description: 'Range to analyze, e.g. "A1:A10", "B2:D5", or column letter like "A"',
      },
    },
    required: ['rangeDescription'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      analysis: { type: 'string' },
      statistics: { type: 'object' },
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

    const cells = extractCellsFromRange(context.artifact, rangeDescription);

    if (cells.length === 0) {
      return {
        proposedOperations: [],
        previewText: `No cells found in range "${rangeDescription}".`,
        output: { analysis: 'No data found', statistics: {} },
      };
    }

    let analysisText: string;
    let statistics: Record<string, unknown>;

    if (context.callLlm) {
      // Real LLM call - gather data summary
      const numbers: number[] = [];
      const strings: string[] = [];
      let emptyCount = 0;

      for (const cell of cells) {
        if (cell.valueType === 'empty' || cell.rawValue === null || cell.rawValue === '') {
          emptyCount++;
        } else if (cell.valueType === 'number' || typeof cell.rawValue === 'number') {
          const num = typeof cell.rawValue === 'number' ? cell.rawValue : Number(cell.rawValue);
          if (!isNaN(num)) numbers.push(num);
        } else if (typeof cell.rawValue === 'string') {
          strings.push(cell.rawValue);
        }
      }

      const dataDescription = `Range: ${rangeDescription}
Total cells: ${cells.length}
Numeric values: ${numbers.join(', ')}
Text values: ${strings.slice(0, 10).join(', ')}${strings.length > 10 ? '...' : ''}
Empty cells: ${emptyCount}`;

      const systemPrompt = 'You are a data analyst. Analyze the provided data and give a brief summary with key insights. Be concise.';
      const userPrompt = `Analyze this data:\n\n${dataDescription}`;
      analysisText = await context.callLlm({ systemPrompt, userPrompt });
      analysisText = analysisText.trim();

      // Build basic statistics for output
      statistics = {
        totalCells: cells.length,
        emptyCells: emptyCount,
        numericCells: numbers.length,
        textCells: strings.length,
      };

      if (numbers.length > 0) {
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        statistics.sum = sum;
        statistics.average = avg;
        statistics.min = Math.min(...numbers);
        statistics.max = Math.max(...numbers);
      }
    } else {
      // Fallback to deterministic logic
      const numbers: number[] = [];
      const strings: string[] = [];
      let emptyCount = 0;
      let errorCount = 0;

      for (const cell of cells) {
        if (cell.valueType === 'empty' || cell.rawValue === null || cell.rawValue === '') {
          emptyCount++;
        } else if (cell.valueType === 'error') {
          errorCount++;
        } else if (cell.valueType === 'number' || typeof cell.rawValue === 'number') {
          const num = typeof cell.rawValue === 'number' ? cell.rawValue : Number(cell.rawValue);
          if (!isNaN(num)) numbers.push(num);
        } else if (typeof cell.rawValue === 'string') {
          strings.push(cell.rawValue);
        }
      }

      const lines: string[] = [];
      lines.push(`Data Analysis for range ${rangeDescription}`);
      lines.push(`${'='.repeat(40)}`);
      lines.push(`Total cells: ${cells.length}`);
      lines.push(`Non-empty cells: ${cells.length - emptyCount}`);
      if (emptyCount > 0) lines.push(`Empty cells: ${emptyCount}`);
      if (errorCount > 0) lines.push(`Error cells: ${errorCount}`);
      if (strings.length > 0) lines.push(`Text cells: ${strings.length}`);

      statistics = {
        totalCells: cells.length,
        emptyCells: emptyCount,
        errorCells: errorCount,
        textCells: strings.length,
        numericCells: numbers.length,
      };

      if (numbers.length > 0) {
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        const stdDev = computeStandardDeviation(numbers, avg);
        const trend = detectTrend(numbers);
        const outliers = detectOutliers(numbers, avg, stdDev);

        lines.push('');
        lines.push('Numeric Statistics:');
        lines.push(`  Count: ${numbers.length}`);
        lines.push(`  Sum: ${parseFloat(sum.toPrecision(10))}`);
        lines.push(`  Average: ${parseFloat(avg.toPrecision(10))}`);
        lines.push(`  Min: ${min}`);
        lines.push(`  Max: ${max}`);
        lines.push(`  Std Dev: ${parseFloat(stdDev.toPrecision(6))}`);
        lines.push(`  Trend: ${trend}`);

        if (outliers.length > 0) {
          lines.push('');
          lines.push(`Outliers detected (>2 std dev from mean): ${outliers.join(', ')}`);
        }

        statistics.sum = sum;
        statistics.average = avg;
        statistics.min = min;
        statistics.max = max;
        statistics.standardDeviation = stdDev;
        statistics.trend = trend;
        statistics.outliers = outliers;
      }

      analysisText = lines.join('\n');
    }

    return {
      proposedOperations: [],
      previewText: analysisText,
      output: { analysis: analysisText, statistics },
    };
  },
};
