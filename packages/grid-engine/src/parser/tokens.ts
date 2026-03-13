export type TokenType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'cell'
  | 'range'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'comma'
  | 'lparen'
  | 'rparen'
  | 'identifier'
  | 'equals'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}
