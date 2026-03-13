import type { AgentActionID, FunctionCallID, ObjectID, OperationID } from './ids.js';

export type AgentName = string;

export interface AgentFunctionCallRecord {
  functionCallId: FunctionCallID;
  functionName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs?: number;
}

export interface AgentActionRecord {
  actionId: AgentActionID;
  agentName: AgentName;
  taskType: string;
  inputSummary: string;
  functionCalls: AgentFunctionCallRecord[];
  changedObjectIds: ObjectID[];
  operationIds: OperationID[];
  approvalState: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  groundingRefs?: string[];
  timestamp: string;
}
