import type { BaseNode, ObjectID } from '@opencanvas/core-types';

// ---------------------------------------------------------------------------
// Cell value types
// ---------------------------------------------------------------------------

export type CellValueType = 'string' | 'number' | 'boolean' | 'error' | 'empty';

// ---------------------------------------------------------------------------
// Grid node types
// ---------------------------------------------------------------------------

export interface WorkbookNode extends BaseNode {
  type: 'workbook';
  title: string;
}

export interface WorksheetNode extends BaseNode {
  type: 'worksheet';
  name: string;
  columnCount: number;
  rowCount: number;
}

export interface CellNode extends BaseNode {
  type: 'cell';
  /** e.g. "A1", "B12" */
  address: string;
  /** The raw value entered by the user (not formula result) */
  rawValue: string | number | boolean | null;
  /** If the cell contains a formula, it starts with "=" */
  formula: string | null;
  /** The computed display value after evaluation */
  displayValue: string;
  /** Resolved type of the cell value */
  valueType: CellValueType;
}

export interface NamedRangeNode extends BaseNode {
  type: 'named_range';
  name: string;
  /** e.g. "Sheet1!A1:B10" */
  rangeExpression: string;
  worksheetId: ObjectID;
}

export interface TableNode extends BaseNode {
  type: 'table';
  name: string;
  /** Top-left cell address */
  startAddress: string;
  /** Bottom-right cell address */
  endAddress: string;
  worksheetId: ObjectID;
  hasHeaders: boolean;
}

export interface ChartNode extends BaseNode {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  title: string;
  /** Range expression for the data source */
  dataRange: string;
  worksheetId: ObjectID;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Union of all grid node types
// ---------------------------------------------------------------------------

export type GridNode =
  | WorkbookNode
  | WorksheetNode
  | CellNode
  | NamedRangeNode
  | TableNode
  | ChartNode;
