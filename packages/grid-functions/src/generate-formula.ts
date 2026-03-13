import { v4 as uuidv4 } from 'uuid';
import type { SetFormulaOperation } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

/**
 * MVP deterministic formula generator.
 * Takes a natural language description and a target cell, returns a set_formula operation.
 * In a real implementation, this would call an LLM via the model-router.
 */

const PATTERN_MAP: Array<{ pattern: RegExp; formula: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /sum\s+(?:of\s+)?([A-Z]+\d+)\s*(?:to|through|:|-)\s*([A-Z]+\d+)/i,
    formula: (m) => `=SUM(${m[1]!.toUpperCase()}:${m[2]!.toUpperCase()})`,
  },
  {
    pattern: /average\s+(?:of\s+)?([A-Z]+\d+)\s*(?:to|through|:|-)\s*([A-Z]+\d+)/i,
    formula: (m) => `=AVERAGE(${m[1]!.toUpperCase()}:${m[2]!.toUpperCase()})`,
  },
  {
    pattern: /max(?:imum)?\s+(?:of\s+)?([A-Z]+\d+)\s*(?:to|through|:|-)\s*([A-Z]+\d+)/i,
    formula: (m) => `=MAX(${m[1]!.toUpperCase()}:${m[2]!.toUpperCase()})`,
  },
  {
    pattern: /min(?:imum)?\s+(?:of\s+)?([A-Z]+\d+)\s*(?:to|through|:|-)\s*([A-Z]+\d+)/i,
    formula: (m) => `=MIN(${m[1]!.toUpperCase()}:${m[2]!.toUpperCase()})`,
  },
  {
    pattern: /count\s+(?:of\s+)?([A-Z]+\d+)\s*(?:to|through|:|-)\s*([A-Z]+\d+)/i,
    formula: (m) => `=COUNT(${m[1]!.toUpperCase()}:${m[2]!.toUpperCase()})`,
  },
  {
    pattern: /add\s+([A-Z]+\d+)\s+(?:and|plus|\+)\s+([A-Z]+\d+)/i,
    formula: (m) => `=${m[1]!.toUpperCase()}+${m[2]!.toUpperCase()}`,
  },
  {
    pattern: /multiply\s+([A-Z]+\d+)\s+(?:by|times|\*)\s+([A-Z]+\d+)/i,
    formula: (m) => `=${m[1]!.toUpperCase()}*${m[2]!.toUpperCase()}`,
  },
];

function generateFormulaFromDescription(description: string): string {
  for (const entry of PATTERN_MAP) {
    const match = entry.pattern.exec(description);
    if (match) {
      return entry.formula(match);
    }
  }
  // Fallback: return a SUM of A1:A10 as a default
  return '=SUM(A1:A10)';
}

export const generateFormulaFunction: RegisteredFunction = {
  name: 'generate_formula',
  description:
    'Generate a spreadsheet formula from a natural language description and apply it to a target cell',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Natural language description of the desired formula',
      },
      targetCellId: {
        type: 'string',
        description: 'Object ID of the target cell node',
      },
    },
    required: ['description'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      generatedFormula: { type: 'string' },
    },
  },
  permissions: {
    scope: 'object',
    mutatesArtifact: true,
    requiresApproval: true,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const description = context.parameters.description as string;
    if (!description) {
      throw new Error('Missing required parameter: description');
    }

    const targetId = (context.parameters.targetCellId as string) ?? context.targetId;
    const node = context.artifact.nodes[targetId];
    if (!node) {
      throw new Error(`Target node "${targetId}" not found in artifact`);
    }

    // Get cell address for context
    const cellAddress = node && typeof node === 'object' && 'address' in node
      ? String((node as Record<string, unknown>).address)
      : targetId;

    let generatedFormula: string;

    if (context.callLlm) {
      // Real LLM call
      const systemPrompt = 'You are a spreadsheet expert. Generate a spreadsheet formula from the description. Return ONLY the formula starting with \'=\' and nothing else.';
      const userPrompt = `Generate a spreadsheet formula for: ${description}\n\nContext: Target cell ${cellAddress}`;
      const response = await context.callLlm({ systemPrompt, userPrompt });

      // Extract formula (should start with =)
      const lines = response.split('\n').map((line) => line.trim());
      const formulaLine = lines.find((line) => line.startsWith('='));
      generatedFormula = formulaLine || response.trim();

      // Ensure it starts with =
      if (!generatedFormula.startsWith('=')) {
        generatedFormula = '=' + generatedFormula;
      }
    } else {
      // Fallback to deterministic logic
      generatedFormula = generateFormulaFromDescription(description);
    }

    const previousFormula =
      node && typeof node === 'object' && 'formula' in node
        ? ((node as Record<string, unknown>).formula as string | undefined)
        : undefined;

    const op: SetFormulaOperation = {
      operationId: uuidv4(),
      type: 'set_formula',
      artifactId: context.artifact.artifactId,
      targetId,
      actorType: 'agent',
      actorId: 'grid-formula-agent',
      timestamp: new Date().toISOString(),
      payload: {
        formula: generatedFormula,
        previousFormula: previousFormula ?? undefined,
      },
    };

    return {
      proposedOperations: [op],
      previewText: `Generated formula: ${generatedFormula}`,
      output: { generatedFormula },
    };
  },
};
