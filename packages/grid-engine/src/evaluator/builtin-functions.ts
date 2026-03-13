import type { EvaluatedScalar, EvaluatedValue } from './types.js';

type BuiltinFn = (args: EvaluatedValue[]) => EvaluatedScalar;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenToNumbers(args: EvaluatedValue[]): number[] {
  const nums: number[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const v of arg) {
        if (typeof v === 'number') nums.push(v);
        else if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) nums.push(Number(v));
      }
    } else {
      if (typeof arg === 'number') nums.push(arg);
      else if (typeof arg === 'string' && arg !== '' && !isNaN(Number(arg))) nums.push(Number(arg));
    }
  }
  return nums;
}

function flattenAll(args: EvaluatedValue[]): EvaluatedScalar[] {
  const result: EvaluatedScalar[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      result.push(...arg);
    } else {
      result.push(arg);
    }
  }
  return result;
}

/** Coerce an EvaluatedValue to a single scalar. */
function toScalar(val: EvaluatedValue): EvaluatedScalar {
  return Array.isArray(val) ? val[0] ?? null : val;
}

/** Coerce a value to a number; non-numeric values become 0. */
function toNumber(val: EvaluatedScalar): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) return Number(val);
  return 0;
}

/** Coerce a value to a string. */
function toStr(val: EvaluatedScalar): string {
  if (val === null) return '';
  return String(val);
}

/** Coerce a value to a boolean. */
function toBool(val: EvaluatedScalar): boolean {
  return val !== false && val !== 0 && val !== null && val !== '';
}

/**
 * Check whether a cell value matches a criteria string.
 * Supported criteria forms:
 *   ">5"  ">=10"  "<3"  "<>0"  "=hello"  "hello" (plain equality)
 */
function matchesCriteria(value: EvaluatedScalar, criteria: string): boolean {
  const match = /^(>=|<=|<>|>|<|=)(.*)$/.exec(criteria);
  if (match) {
    const op = match[1];
    const operandStr = match[2];
    const operandNum = Number(operandStr);
    const useNumeric = !isNaN(operandNum) && typeof value === 'number';

    switch (op) {
      case '>=': return useNumeric ? value >= operandNum : toStr(value) >= operandStr;
      case '<=': return useNumeric ? value <= operandNum : toStr(value) <= operandStr;
      case '<>': return useNumeric ? value !== operandNum : toStr(value) !== operandStr;
      case '>':  return useNumeric ? value > operandNum  : toStr(value) > operandStr;
      case '<':  return useNumeric ? value < operandNum  : toStr(value) < operandStr;
      case '=':  return useNumeric ? value === operandNum : toStr(value) === operandStr;
    }
  }
  // Plain string: equality comparison (case-insensitive for strings)
  const criteriaNum = Number(criteria);
  if (!isNaN(criteriaNum) && criteria !== '') {
    return toNumber(value) === criteriaNum;
  }
  return toStr(value).toLowerCase() === criteria.toLowerCase();
}

// ---------------------------------------------------------------------------
// Original 7 built-in functions
// ---------------------------------------------------------------------------

const SUM: BuiltinFn = (args) => {
  const nums = flattenToNumbers(args);
  return nums.reduce((acc, n) => acc + n, 0);
};

const AVERAGE: BuiltinFn = (args) => {
  const nums = flattenToNumbers(args);
  if (nums.length === 0) return 0;
  return nums.reduce((acc, n) => acc + n, 0) / nums.length;
};

const MIN: BuiltinFn = (args) => {
  const nums = flattenToNumbers(args);
  if (nums.length === 0) return 0;
  return Math.min(...nums);
};

const MAX: BuiltinFn = (args) => {
  const nums = flattenToNumbers(args);
  if (nums.length === 0) return 0;
  return Math.max(...nums);
};

const COUNT: BuiltinFn = (args) => {
  const all = flattenAll(args);
  return all.filter((v) => typeof v === 'number').length;
};

const IF: BuiltinFn = (args) => {
  const [condition, trueVal, falseVal] = args;
  const condScalar = Array.isArray(condition) ? condition[0] : condition;
  const isTruthy = condScalar !== false && condScalar !== 0 && condScalar !== null && condScalar !== '';
  const result = isTruthy ? trueVal : falseVal;
  if (result === undefined) return isTruthy ? true : false;
  return Array.isArray(result) ? result[0] ?? null : result;
};

const CONCAT: BuiltinFn = (args) => {
  const all = flattenAll(args);
  return all.map((v) => (v === null ? '' : String(v))).join('');
};

// ---------------------------------------------------------------------------
// Math functions
// ---------------------------------------------------------------------------

const ABS: BuiltinFn = (args) => {
  const val = toNumber(toScalar(args[0]));
  return Math.abs(val);
};

const ROUND: BuiltinFn = (args) => {
  const val = toNumber(toScalar(args[0]));
  const digits = args[1] !== undefined ? toNumber(toScalar(args[1])) : 0;
  const factor = Math.pow(10, digits);
  return Math.round(val * factor) / factor;
};

const FLOOR: BuiltinFn = (args) => {
  const val = toNumber(toScalar(args[0]));
  return Math.floor(val);
};

const CEILING: BuiltinFn = (args) => {
  const val = toNumber(toScalar(args[0]));
  return Math.ceil(val);
};

const MOD: BuiltinFn = (args) => {
  const num = toNumber(toScalar(args[0]));
  const divisor = toNumber(toScalar(args[1]));
  if (divisor === 0) return '#DIV/0!';
  return num % divisor;
};

const POWER: BuiltinFn = (args) => {
  const base = toNumber(toScalar(args[0]));
  const exponent = toNumber(toScalar(args[1]));
  return Math.pow(base, exponent);
};

const SQRT: BuiltinFn = (args) => {
  const val = toNumber(toScalar(args[0]));
  if (val < 0) return '#NUM!';
  return Math.sqrt(val);
};

const INT: BuiltinFn = (args) => {
  const val = toNumber(toScalar(args[0]));
  return Math.trunc(val);
};

// ---------------------------------------------------------------------------
// Text functions
// ---------------------------------------------------------------------------

const LEN: BuiltinFn = (args) => {
  const text = toStr(toScalar(args[0]));
  return text.length;
};

const LEFT: BuiltinFn = (args) => {
  const text = toStr(toScalar(args[0]));
  const count = args[1] !== undefined ? toNumber(toScalar(args[1])) : 1;
  return text.substring(0, count);
};

const RIGHT: BuiltinFn = (args) => {
  const text = toStr(toScalar(args[0]));
  const count = args[1] !== undefined ? toNumber(toScalar(args[1])) : 1;
  return text.substring(Math.max(0, text.length - count));
};

const MID: BuiltinFn = (args) => {
  const text = toStr(toScalar(args[0]));
  const start = toNumber(toScalar(args[1]));
  const count = toNumber(toScalar(args[2]));
  // Spreadsheet MID is 1-indexed
  return text.substring(start - 1, start - 1 + count);
};

const UPPER: BuiltinFn = (args) => {
  return toStr(toScalar(args[0])).toUpperCase();
};

const LOWER: BuiltinFn = (args) => {
  return toStr(toScalar(args[0])).toLowerCase();
};

const TRIM: BuiltinFn = (args) => {
  return toStr(toScalar(args[0])).trim();
};

const SUBSTITUTE: BuiltinFn = (args) => {
  const text = toStr(toScalar(args[0]));
  const oldText = toStr(toScalar(args[1]));
  const newText = toStr(toScalar(args[2]));
  if (oldText === '') return text;
  // Replace all occurrences, matching spreadsheet behavior
  return text.split(oldText).join(newText);
};

// ---------------------------------------------------------------------------
// Logical functions
// ---------------------------------------------------------------------------

const AND: BuiltinFn = (args) => {
  const all = flattenAll(args);
  if (all.length === 0) return '#VALUE!';
  return all.every((v) => toBool(v));
};

const OR: BuiltinFn = (args) => {
  const all = flattenAll(args);
  if (all.length === 0) return '#VALUE!';
  return all.some((v) => toBool(v));
};

const NOT: BuiltinFn = (args) => {
  const val = toScalar(args[0]);
  return !toBool(val);
};

const IFERROR: BuiltinFn = (args) => {
  const val = toScalar(args[0]);
  const fallback = args[1] !== undefined ? toScalar(args[1]) : null;
  // Error values in this engine are strings starting with '#'
  if (typeof val === 'string' && val.startsWith('#')) {
    return fallback;
  }
  return val;
};

// ---------------------------------------------------------------------------
// Lookup / reference (simplified)
// ---------------------------------------------------------------------------

const COUNTA: BuiltinFn = (args) => {
  const all = flattenAll(args);
  return all.filter((v) => v !== null && v !== '').length;
};

const COUNTIF: BuiltinFn = (args) => {
  const rangeValues = flattenAll([args[0]]);
  const criteria = toStr(toScalar(args[1]));
  let count = 0;
  for (const v of rangeValues) {
    if (matchesCriteria(v, criteria)) count++;
  }
  return count;
};

const SUMIF: BuiltinFn = (args) => {
  const rangeValues = Array.isArray(args[0]) ? args[0] : [args[0]];
  const criteria = toStr(toScalar(args[1]));
  // If a sum_range is provided, sum from that range; otherwise sum from the criteria range
  const sumValues = args[2] !== undefined
    ? (Array.isArray(args[2]) ? args[2] : [args[2]])
    : rangeValues;

  let total = 0;
  for (let i = 0; i < rangeValues.length; i++) {
    if (matchesCriteria(rangeValues[i], criteria)) {
      total += toNumber(i < sumValues.length ? sumValues[i] : null);
    }
  }
  return total;
};

// ---------------------------------------------------------------------------
// Export registry
// ---------------------------------------------------------------------------

export const builtinFunctions: Record<string, BuiltinFn> = {
  // Original
  SUM,
  AVERAGE,
  MIN,
  MAX,
  COUNT,
  IF,
  CONCAT,
  // Math
  ABS,
  ROUND,
  FLOOR,
  CEILING,
  MOD,
  POWER,
  SQRT,
  INT,
  // Text
  LEN,
  LEFT,
  RIGHT,
  MID,
  UPPER,
  LOWER,
  TRIM,
  SUBSTITUTE,
  // Logical
  AND,
  OR,
  NOT,
  IFERROR,
  // Lookup / reference
  COUNTA,
  COUNTIF,
  SUMIF,
};
