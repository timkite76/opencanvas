export interface NumberLiteral {
  kind: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  kind: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface CellReference {
  kind: 'CellReference';
  address: string; // e.g. "A1"
}

export interface RangeReference {
  kind: 'RangeReference';
  range: string; // e.g. "A1:B10"
}

export interface BinaryExpression {
  kind: 'BinaryExpression';
  operator: '+' | '-' | '*' | '/';
  left: FormulaAstNode;
  right: FormulaAstNode;
}

export interface FunctionCall {
  kind: 'FunctionCall';
  name: string;
  args: FormulaAstNode[];
}

export type FormulaAstNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | CellReference
  | RangeReference
  | BinaryExpression
  | FunctionCall;
