import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

/**
 * MVP deterministic formula explainer.
 * Takes a cell with a formula and returns a human-readable explanation.
 * In a real implementation, this would call an LLM via the model-router.
 */

function explainFormula(formula: string): string {
  if (!formula || !formula.startsWith('=')) {
    return 'This cell does not contain a formula.';
  }

  const body = formula.slice(1).trim();
  const parts: string[] = [];

  // Detect function calls
  const funcPattern = /([A-Z]+)\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = funcPattern.exec(body)) !== null) {
    const funcName = match[1]!.toUpperCase();
    const args = match[2]!;

    if (seen.has(funcName + args)) continue;
    seen.add(funcName + args);

    switch (funcName) {
      case 'SUM':
        parts.push(`Calculates the sum of ${args}`);
        break;
      case 'AVERAGE':
        parts.push(`Calculates the average of ${args}`);
        break;
      case 'MIN':
        parts.push(`Finds the minimum value in ${args}`);
        break;
      case 'MAX':
        parts.push(`Finds the maximum value in ${args}`);
        break;
      case 'COUNT':
        parts.push(`Counts the numeric values in ${args}`);
        break;
      case 'IF':
        parts.push(`Evaluates a condition: ${args}`);
        break;
      case 'CONCAT':
        parts.push(`Concatenates the values: ${args}`);
        break;
      default:
        parts.push(`Calls function ${funcName} with arguments ${args}`);
    }
  }

  // Detect arithmetic
  if (/[+\-*/]/.test(body) && parts.length === 0) {
    parts.push(`Performs arithmetic: ${body}`);
  }

  // Detect cell references not inside functions
  const cellRefs = body.match(/\b[A-Z]+\d+\b/gi);
  if (cellRefs && cellRefs.length > 0 && parts.length === 0) {
    parts.push(`References cells: ${cellRefs.join(', ')}`);
  }

  if (parts.length === 0) {
    parts.push(`Formula: ${formula}`);
  }

  return `This formula: ${formula}\n\n${parts.join('. ')}.`;
}

export const explainFormulaFunction: RegisteredFunction = {
  name: 'explain_formula',
  description: 'Explain what a spreadsheet formula does in plain English',
  inputSchema: {
    type: 'object',
    properties: {
      cellId: {
        type: 'string',
        description: 'Object ID of the cell to explain',
      },
    },
    required: [],
  },
  outputSchema: {
    type: 'object',
    properties: {
      explanation: { type: 'string' },
      formula: { type: 'string' },
    },
  },
  permissions: {
    scope: 'object',
    mutatesArtifact: false,
    requiresApproval: false,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const cellId = (context.parameters.cellId as string) ?? context.targetId;
    const node = context.artifact.nodes[cellId];
    if (!node) {
      throw new Error(`Cell "${cellId}" not found in artifact`);
    }

    const formula =
      node && typeof node === 'object' && 'formula' in node
        ? ((node as Record<string, unknown>).formula as string | null)
        : null;

    if (!formula) {
      return {
        proposedOperations: [],
        previewText: 'This cell does not contain a formula.',
        output: { explanation: 'This cell does not contain a formula.', formula: null },
      };
    }

    let explanation: string;

    if (context.callLlm) {
      // Real LLM call
      const systemPrompt = 'You are a spreadsheet expert. Explain the formula in plain language. Be concise (2-3 sentences).';
      const userPrompt = `Explain this spreadsheet formula:\n\n${formula}`;
      explanation = await context.callLlm({ systemPrompt, userPrompt });
      explanation = explanation.trim();
    } else {
      // Fallback to deterministic logic
      explanation = explainFormula(formula);
    }

    return {
      proposedOperations: [],
      previewText: explanation,
      output: { explanation, formula },
    };
  },
};
