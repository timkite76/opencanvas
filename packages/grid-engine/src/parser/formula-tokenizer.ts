import type { Token, TokenType } from './tokens.js';

const CELL_RE = /^[A-Z]+\d+/;
const RANGE_RE = /^[A-Z]+\d+:[A-Z]+\d+/;
const NUMBER_RE = /^\d+(\.\d+)?/;
const IDENTIFIER_RE = /^[A-Z_][A-Z0-9_]*/;
const STRING_RE = /^"([^"]*)"/ ;

/**
 * Tokenize a formula string. The leading "=" is optional and will be skipped.
 */
export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let input = formula;

  // Skip leading "="
  if (input.startsWith('=')) {
    pos = 1;
    input = input.slice(1);
  }

  while (pos <= formula.length && input.length > 0) {
    // Skip whitespace
    if (input[0] === ' ' || input[0] === '\t') {
      input = input.slice(1);
      pos++;
      continue;
    }

    // String literal
    const strMatch = STRING_RE.exec(input);
    if (strMatch) {
      tokens.push({ type: 'string', value: strMatch[1]!, position: pos });
      pos += strMatch[0].length;
      input = input.slice(strMatch[0].length);
      continue;
    }

    // Boolean literals
    const upperStart = input.slice(0, 5).toUpperCase();
    if (upperStart.startsWith('TRUE') && (input.length === 4 || !/[A-Z0-9_]/i.test(input[4]!))) {
      tokens.push({ type: 'boolean', value: 'TRUE', position: pos });
      pos += 4;
      input = input.slice(4);
      continue;
    }
    if (upperStart.startsWith('FALSE') && (input.length === 5 || !/[A-Z0-9_]/i.test(input[5] ?? ''))) {
      tokens.push({ type: 'boolean', value: 'FALSE', position: pos });
      pos += 5;
      input = input.slice(5);
      continue;
    }

    // Range (must check before cell since range is cell:cell)
    const upperInput = input.toUpperCase();
    const rangeMatch = RANGE_RE.exec(upperInput);
    if (rangeMatch) {
      tokens.push({ type: 'range', value: rangeMatch[0], position: pos });
      pos += rangeMatch[0].length;
      input = input.slice(rangeMatch[0].length);
      continue;
    }

    // Cell reference (only if followed by non-alphanumeric or end of string, and it's not a function name)
    const cellMatch = CELL_RE.exec(upperInput);
    if (cellMatch) {
      // Peek ahead: if the next char after the cell match is '(' it's a function, not a cell
      const rest = input.slice(cellMatch[0].length);
      if (!rest.startsWith('(')) {
        tokens.push({ type: 'cell', value: cellMatch[0], position: pos });
        pos += cellMatch[0].length;
        input = input.slice(cellMatch[0].length);
        continue;
      }
    }

    // Number literal
    const numMatch = NUMBER_RE.exec(input);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[0], position: pos });
      pos += numMatch[0].length;
      input = input.slice(numMatch[0].length);
      continue;
    }

    // Identifier (function names like SUM, AVERAGE, etc.)
    const idMatch = IDENTIFIER_RE.exec(upperInput);
    if (idMatch) {
      tokens.push({ type: 'identifier', value: idMatch[0], position: pos });
      pos += idMatch[0].length;
      input = input.slice(idMatch[0].length);
      continue;
    }

    // Single-character tokens
    const ch = input[0]!;
    let type: TokenType | null = null;
    switch (ch) {
      case '+': type = 'plus'; break;
      case '-': type = 'minus'; break;
      case '*': type = 'star'; break;
      case '/': type = 'slash'; break;
      case ',': type = 'comma'; break;
      case '(': type = 'lparen'; break;
      case ')': type = 'rparen'; break;
      case '=': type = 'equals'; break;
      default:
        throw new Error(`Unexpected character "${ch}" at position ${pos}`);
    }
    tokens.push({ type, value: ch, position: pos });
    pos++;
    input = input.slice(1);
  }

  tokens.push({ type: 'eof', value: '', position: pos });
  return tokens;
}
