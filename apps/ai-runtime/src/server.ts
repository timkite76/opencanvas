import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import type { Operation, AgentActionRecord } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { FunctionResult } from '@opencanvas/function-sdk';
import { InMemoryFunctionRegistry } from '@opencanvas/function-registry';
import { rewriteBlockFunction } from '@opencanvas/function-examples';
import { generateFormulaFunction, explainFormulaFunction } from '@opencanvas/grid-functions';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const registry = new InMemoryFunctionRegistry();
registry.register(rewriteBlockFunction);
registry.register(generateFormulaFunction);
registry.register(explainFormulaFunction);

interface PendingTask {
  taskId: string;
  taskType: string;
  actorUserId?: string;
  functionName: string;
  proposedOperations: Operation[];
  previewText?: string;
  requiresApproval: boolean;
  createdAt: string;
}

const pendingTasks = new Map<string, PendingTask>();
const actionLog: AgentActionRecord[] = [];

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', functions: registry.list().length });
});

// List functions
app.get('/functions', (_req, res) => {
  const fns = registry.list().map((fn) => ({
    name: fn.name,
    description: fn.description,
    inputSchema: fn.inputSchema,
    outputSchema: fn.outputSchema,
    permissions: fn.permissions,
  }));
  res.json({ functions: fns });
});

// Preview AI task
app.post('/ai/tasks/preview', async (req, res) => {
  try {
    const { taskType, targetId, selectionStart, selectionEnd, parameters, artifact } = req.body as {
      taskType: string;
      targetId: string;
      selectionStart?: number;
      selectionEnd?: number;
      parameters: Record<string, unknown>;
      artifact: ArtifactEnvelope;
    };

    const fn = registry.get(taskType);
    if (!fn) {
      res.status(404).json({ error: `Function "${taskType}" not found` });
      return;
    }

    const result: FunctionResult = await fn.execute({
      artifact,
      targetId,
      selectionStart,
      selectionEnd,
      parameters,
    });

    const taskId = uuidv4();
    const pending: PendingTask = {
      taskId,
      taskType,
      functionName: fn.name,
      proposedOperations: result.proposedOperations,
      previewText: result.previewText,
      requiresApproval: fn.permissions.requiresApproval,
      createdAt: new Date().toISOString(),
    };
    pendingTasks.set(taskId, pending);

    const actionRecord: AgentActionRecord = {
      actionId: uuidv4(),
      agentName: 'writer',
      taskType,
      inputSummary: `${taskType} on ${targetId}`,
      functionCalls: [
        {
          functionCallId: uuidv4(),
          functionName: fn.name,
          input: parameters,
          output: result.output ?? {},
        },
      ],
      changedObjectIds: [targetId],
      operationIds: result.proposedOperations.map((op) => op.operationId),
      approvalState: 'pending',
      timestamp: new Date().toISOString(),
    };
    actionLog.push(actionRecord);

    res.json({
      taskId,
      status: 'preview',
      previewText: result.previewText,
      proposedOperations: result.proposedOperations,
      requiresApproval: fn.permissions.requiresApproval,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Approve task
app.post('/ai/tasks/:taskId/approve', (req, res) => {
  const { taskId } = req.params;
  const pending = pendingTasks.get(taskId);
  if (!pending) {
    res.status(404).json({ error: `Task "${taskId}" not found` });
    return;
  }

  pendingTasks.delete(taskId);

  const logEntry = actionLog.find(
    (entry) =>
      entry.operationIds.some((opId) =>
        pending.proposedOperations.some((op) => op.operationId === opId),
      ),
  );
  if (logEntry) {
    logEntry.approvalState = 'approved';
  }

  res.json({
    taskId,
    status: 'approved',
    approvedOperations: pending.proposedOperations,
  });
});

// Reject task
app.post('/ai/tasks/:taskId/reject', (req, res) => {
  const { taskId } = req.params;
  const pending = pendingTasks.get(taskId);
  if (!pending) {
    res.status(404).json({ error: `Task "${taskId}" not found` });
    return;
  }

  pendingTasks.delete(taskId);

  const logEntry = actionLog.find(
    (entry) =>
      entry.operationIds.some((opId) =>
        pending.proposedOperations.some((op) => op.operationId === opId),
      ),
  );
  if (logEntry) {
    logEntry.approvalState = 'rejected';
  }

  res.json({ taskId, status: 'rejected' });
});

const PORT = process.env.PORT ?? 4001;
app.listen(PORT, () => {
  console.log(`[ai-runtime] listening on http://localhost:${PORT}`);
  console.log(`[ai-runtime] registered functions: ${registry.list().map((f) => f.name).join(', ')}`);
});
