import type { EvaluatedScalar, EvaluatedValue } from './types.js';

type BuiltinFn = (args: EvaluatedValue[]) => EvaluatedScalar;

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

export const builtinFunctions: Record<string, BuiltinFn> = {
  SUM,
  AVERAGE,
  MIN,
  MAX,
  COUNT,
  IF,
  CONCAT,
};
