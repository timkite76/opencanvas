import type { Token } from './tokens.js';
import type { FormulaAstNode } from './ast.js';
import { tokenize } from './formula-tokenizer.js';

/**
 * Recursive-descent parser for spreadsheet formulas.
 *
 * Grammar:
 *   expression    -> additive
 *   additive      -> multiplicative ( ('+' | '-') multiplicative )*
 *   multiplicative -> primary ( ('*' | '/') primary )*
 *   primary       -> NUMBER | STRING | BOOLEAN | CELL | RANGE
 *                  | IDENTIFIER '(' argList? ')'
 *                  | '(' expression ')'
 *                  | '-' primary   (unary minus)
 *   argList       -> expression ( ',' expression )*
 */

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private advance(): Token {
    const tok = this.tokens[this.pos]!;
    this.pos++;
    return tok;
  }

  private expect(type: string): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new Error(`Expected "${type}" but got "${tok.type}" ("${tok.value}") at position ${tok.position}`);
    }
    return this.advance();
  }

  parse(): FormulaAstNode {
    const node = this.expression();
    if (this.peek().type !== 'eof') {
      throw new Error(`Unexpected token "${this.peek().value}" at position ${this.peek().position}`);
    }
    return node;
  }

  private expression(): FormulaAstNode {
    return this.additive();
  }

  private additive(): FormulaAstNode {
    let left = this.multiplicative();

    while (this.peek().type === 'plus' || this.peek().type === 'minus') {
      const opToken = this.advance();
      const right = this.multiplicative();
      left = {
        kind: 'BinaryExpression',
        operator: opToken.value as '+' | '-',
        left,
        right,
      };
    }
    return left;
  }

  private multiplicative(): FormulaAstNode {
    let left = this.primary();

    while (this.peek().type === 'star' || this.peek().type === 'slash') {
      const opToken = this.advance();
      const right = this.primary();
      left = {
        kind: 'BinaryExpression',
        operator: opToken.value as '*' | '/',
        left,
        right,
      };
    }
    return left;
  }

  private primary(): FormulaAstNode {
    const tok = this.peek();

    // Unary minus
    if (tok.type === 'minus') {
      this.advance();
      const operand = this.primary();
      return {
        kind: 'BinaryExpression',
        operator: '-',
        left: { kind: 'NumberLiteral', value: 0 },
        right: operand,
      };
    }

    // Parenthesized expression
    if (tok.type === 'lparen') {
      this.advance();
      const inner = this.expression();
      this.expect('rparen');
      return inner;
    }

    // Number literal
    if (tok.type === 'number') {
      this.advance();
      return { kind: 'NumberLiteral', value: parseFloat(tok.value) };
    }

    // String literal
    if (tok.type === 'string') {
      this.advance();
      return { kind: 'StringLiteral', value: tok.value };
    }

    // Boolean literal
    if (tok.type === 'boolean') {
      this.advance();
      return { kind: 'BooleanLiteral', value: tok.value === 'TRUE' };
    }

    // Range reference
    if (tok.type === 'range') {
      this.advance();
      return { kind: 'RangeReference', range: tok.value };
    }

    // Cell reference
    if (tok.type === 'cell') {
      this.advance();
      return { kind: 'CellReference', address: tok.value };
    }

    // Function call: IDENTIFIER '(' args ')'
    if (tok.type === 'identifier') {
      this.advance();
      this.expect('lparen');
      const args: FormulaAstNode[] = [];
      if (this.peek().type !== 'rparen') {
        args.push(this.expression());
        while (this.peek().type === 'comma') {
          this.advance();
          args.push(this.expression());
        }
      }
      this.expect('rparen');
      return { kind: 'FunctionCall', name: tok.value, args };
    }

    throw new Error(`Unexpected token "${tok.value}" (${tok.type}) at position ${tok.position}`);
  }
}

/**
 * Parse a formula string into an AST. The leading "=" is optional.
 */
export function parseFormula(formula: string): FormulaAstNode {
  const tokens = tokenize(formula);
  return new Parser(tokens).parse();
}
