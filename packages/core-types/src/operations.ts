import type { OperationID, ArtifactID, ObjectID } from './ids.js';

export type OperationType =
  | 'insert_node'
  | 'delete_node'
  | 'update_node'
  | 'move_node'
  | 'set_metadata'
  | 'insert_text'
  | 'delete_text'
  | 'replace_text'
  | 'set_style'
  | 'set_formula'
  | 'set_cell_value'
  | 'resize_object'
  | 'move_object'
  | 'apply_theme'
  | 'create_chart'
  | 'delete_chart'
  | 'batch';

export type ActorType = 'user' | 'agent' | 'system';

export interface BaseOperation {
  operationId: OperationID;
  type: OperationType;
  artifactId: ArtifactID;
  targetId: ObjectID;
  actorType: ActorType;
  actorId?: string;
  timestamp: string;
}

export interface InsertNodeOperation extends BaseOperation {
  type: 'insert_node';
  payload: {
    node: import('./nodes.js').BaseNode;
    parentId: ObjectID;
    index?: number;
  };
}

export interface DeleteNodeOperation extends BaseOperation {
  type: 'delete_node';
}

export interface UpdateNodeOperation extends BaseOperation {
  type: 'update_node';
  payload: {
    patch: Record<string, unknown>;
  };
}

export interface MoveNodeOperation extends BaseOperation {
  type: 'move_node';
  payload: {
    newParentId: ObjectID;
    index?: number;
  };
}

export interface ReplaceTextOperation extends BaseOperation {
  type: 'replace_text';
  payload: {
    startOffset: number;
    endOffset: number;
    newText: string;
    oldText?: string;
  };
}

export interface SetFormulaOperation extends BaseOperation {
  type: 'set_formula';
  payload: {
    formula: string;
    previousFormula?: string;
  };
}

export interface SetCellValueOperation extends BaseOperation {
  type: 'set_cell_value';
  payload: {
    rawValue: string | number | boolean | null;
    previousRawValue?: string | number | boolean | null;
  };
}

export interface MoveObjectOperation extends BaseOperation {
  type: 'move_object';
  payload: {
    x: number;
    y: number;
    previousX?: number;
    previousY?: number;
  };
}

export interface ResizeObjectOperation extends BaseOperation {
  type: 'resize_object';
  payload: {
    width: number;
    height: number;
    previousWidth?: number;
    previousHeight?: number;
  };
}

export interface ApplyThemeOperation extends BaseOperation {
  type: 'apply_theme';
  payload: {
    themeId: string;
    previousThemeId?: string;
  };
}

export interface BatchOperation extends BaseOperation {
  type: 'batch';
  payload: {
    operations: Operation[];
  };
}

export type Operation =
  | InsertNodeOperation
  | DeleteNodeOperation
  | UpdateNodeOperation
  | MoveNodeOperation
  | ReplaceTextOperation
  | SetFormulaOperation
  | SetCellValueOperation
  | MoveObjectOperation
  | ResizeObjectOperation
  | ApplyThemeOperation
  | BatchOperation;
