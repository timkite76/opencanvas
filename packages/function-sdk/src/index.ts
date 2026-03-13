import type { Operation, ObjectID } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';

export type ScopeSelector =
  | 'artifact'
  | 'selection'
  | 'object'
  | 'range'
  | 'slide'
  | 'section'
  | 'worksheet';

export interface FunctionPermissionSpec {
  scope: ScopeSelector;
  mutatesArtifact: boolean;
  requiresApproval: boolean;
}

export interface FunctionExecutionContext {
  artifact: ArtifactEnvelope;
  targetId: ObjectID;
  selectionStart?: number;
  selectionEnd?: number;
  parameters: Record<string, unknown>;
}

export interface FunctionResult {
  proposedOperations: Operation[];
  previewText?: string;
  output?: Record<string, unknown>;
}

export interface RegisteredFunction {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: FunctionPermissionSpec;
  execute: (context: FunctionExecutionContext) => Promise<FunctionResult>;
}
