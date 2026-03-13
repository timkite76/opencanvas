import type { FormulaAstNode } from '../parser/ast.js';
import { parseFormula } from '../parser/formula-parser.js';
import type { EvaluatedScalar, EvaluatedValue, EvaluationContext } from './types.js';
import { builtinFunctions } from './builtin-functions.js';

/**
 * Evaluate a parsed formula AST node given an EvaluationContext.
 */
export function evaluateFormulaAst(
  node: FormulaAstNode,
  ctx: EvaluationContext,
): EvaluatedValue {
  switch (node.kind) {
    case 'NumberLiteral':
      return node.value;

    case 'StringLiteral':
      return node.value;

    case 'BooleanLiteral':
      return node.value;

    case 'CellReference':
      return ctx.getCellValue(node.address);

    case 'RangeReference':
      return ctx.getRangeValues(node.range);

    case 'BinaryExpression': {
      const leftVal = evaluateFormulaAst(node.left, ctx);
      const rightVal = evaluateFormulaAst(node.right, ctx);
      const l = toNumber(Array.isArray(leftVal) ? leftVal[0] ?? null : leftVal);
      const r = toNumber(Array.isArray(rightVal) ? rightVal[0] ?? null : rightVal);
      switch (node.operator) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? '#DIV/0!' : l / r;
      }
      break;
    }

    case 'FunctionCall': {
      const fn = builtinFunctions[node.name.toUpperCase()];
      if (!fn) {
        return `#NAME?`;
      }
      const evaluatedArgs = node.args.map((arg) => evaluateFormulaAst(arg, ctx));
      return fn(evaluatedArgs);
    }
  }
}

/**
 * Parse and evaluate a formula string in one step.
 */
export function evaluateFormulaString(
  formula: string,
  ctx: EvaluationContext,
): EvaluatedScalar {
  const ast = parseFormula(formula);
  const result = evaluateFormulaAst(ast, ctx);
  if (Array.isArray(result)) {
    return result[0] ?? null;
  }
  return result;
}

function toNumber(val: EvaluatedScalar): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) return Number(val);
  return 0;
}
