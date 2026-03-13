import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import type { Operation, AgentActionRecord } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { FunctionResult } from '@opencanvas/function-sdk';
import { InMemoryFunctionRegistry } from '@opencanvas/function-registry';
import {
  rewriteBlockFunction,
  completeTextFunction,
  summarizeDocumentFunction,
  extractActionItemsFunction,
  improveWritingFunction,
  generateOutlineFunction,
} from '@opencanvas/function-examples';
import {
  generateFormulaFunction,
  explainFormulaFunction,
  analyzeDataFunction,
  smartFillFunction,
  cleanDataFunction,
  suggestChartFunction,
} from '@opencanvas/grid-functions';
import {
  createDeckFromOutlineFunction,
  rewriteSlideFunction,
  generateSpeakerNotesFunction,
  suggestLayoutFunction,
  slideCoachFunction,
  enhanceSlideFunction,
  generateFromTemplateFunction,
} from '@opencanvas/deck-functions';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const registry = new InMemoryFunctionRegistry();
registry.register(rewriteBlockFunction);
registry.register(completeTextFunction);
registry.register(summarizeDocumentFunction);
registry.register(extractActionItemsFunction);
registry.register(improveWritingFunction);
registry.register(generateOutlineFunction);
registry.register(generateFormulaFunction);
registry.register(explainFormulaFunction);
registry.register(analyzeDataFunction);
registry.register(smartFillFunction);
registry.register(cleanDataFunction);
registry.register(suggestChartFunction);
registry.register(createDeckFromOutlineFunction);
registry.register(rewriteSlideFunction);
registry.register(generateSpeakerNotesFunction);
registry.register(suggestLayoutFunction);
registry.register(slideCoachFunction);
registry.register(enhanceSlideFunction);
registry.register(generateFromTemplateFunction);

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
      output: result.output ?? null,
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

// --- Action Log Endpoints ---

// GET /ai/action-log - return the full action log
app.get('/ai/action-log', (_req, res) => {
  res.json({ actions: actionLog });
});

// GET /ai/action-log/stats - return aggregated stats
app.get('/ai/action-log/stats', (_req, res) => {
  const total = actionLog.length;
  let approved = 0;
  let rejected = 0;
  let pending = 0;
  const byFunction: Record<string, number> = {};

  for (const entry of actionLog) {
    if (entry.approvalState === 'approved') approved++;
    else if (entry.approvalState === 'rejected') rejected++;
    else if (entry.approvalState === 'pending') pending++;

    for (const fc of entry.functionCalls) {
      byFunction[fc.functionName] = (byFunction[fc.functionName] ?? 0) + 1;
    }
  }

  res.json({
    total,
    approved,
    rejected,
    pending,
    byFunction,
  });
});

const PORT = process.env.PORT ?? 4001;
app.listen(PORT, () => {
  console.log(`[ai-runtime] listening on http://localhost:${PORT}`);
  console.log(`[ai-runtime] registered functions: ${registry.list().map((f) => f.name).join(', ')}`);
});
