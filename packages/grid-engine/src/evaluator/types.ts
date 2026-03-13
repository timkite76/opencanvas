/**
 * A scalar value that a cell can hold after evaluation.
 */
export type EvaluatedScalar = string | number | boolean | null;

/**
 * An evaluated value can be a scalar or an array of scalars (from range expansion).
 */
export type EvaluatedValue = EvaluatedScalar | EvaluatedScalar[];

/**
 * Context provided to the evaluator so it can resolve cell references and ranges.
 */
export interface EvaluationContext {
  /**
   * Resolve a single cell reference to its evaluated scalar value.
   * The address is an uppercase string like "A1".
   */
  getCellValue: (address: string) => EvaluatedScalar;

  /**
   * Expand a range like "A1:A10" into an array of scalar values.
   */
  getRangeValues: (range: string) => EvaluatedScalar[];
}
