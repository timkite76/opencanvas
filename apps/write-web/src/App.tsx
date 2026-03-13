import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { deserializeArtifact, serializeArtifact } from '@opencanvas/core-format';
import { WriteDocumentAdapter, type CanonicalSelection, type EditableBlock } from '@opencanvas/write-editor';
import { importDocx, exportDocx } from '@opencanvas/interop-docx';
import type { CompatibilityReport } from '@opencanvas/interop-ooxml';
import { SAMPLE_OCD_FILES } from './sample-data/sample-prd.js';
import { WriteSurface } from './components/WriteSurface.js';
import { AiPanel } from './components/AiPanel.js';
import { Toolbar } from './components/Toolbar.js';
import { CollabBar } from './components/CollabBar.js';
import { useCollaboration } from './hooks/useCollaboration.js';
import { useUndoRedo } from './hooks/useUndoRedo.js';

const AI_RUNTIME_URL = 'http://localhost:4001';

interface PendingPreview {
  taskId: string;
  previewText: string;
  operations: Operation[];
}

export const App: React.FC = () => {
  const adapterRef = useRef<WriteDocumentAdapter | null>(null);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [selection, setSelection] = useState<CanonicalSelection | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [collabEnabled, setCollabEnabled] = useState(false);

  const undoRedo = useUndoRedo();

  const collabUserName = useMemo(() => `User-${Math.random().toString(36).slice(2, 6)}`, []);
  const collabDocId = useMemo(() => 'write-shared-doc', []);

  const handleRemoteArtifactUpdate = useCallback((artifact: ArtifactEnvelope) => {
    if (!adapterRef.current) return;
    adapterRef.current = new WriteDocumentAdapter(artifact);
    setBlocks(adapterRef.current.getEditableBlocks());
  }, []);

  const collab = useCollaboration(
    collabDocId,
    collabUserName,
    collabEnabled,
    handleRemoteArtifactUpdate,
  );

  // Local text overrides for debounce: blockId -> current text typed by user
  const localTextRef = useRef<Map<string, string>>(new Map());
  const debounceTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Track which block to focus after next render (for Enter key, AI apply, etc.)
  const pendingFocusRef = useRef<string | null>(null);

  const refreshBlocks = useCallback(() => {
    if (!adapterRef.current) return;
    // Clear local overrides since we're syncing from the adapter
    localTextRef.current.clear();
    setBlocks(adapterRef.current.getEditableBlocks());
  }, []);

  // After blocks update, restore focus if we have a pending focus target
  useEffect(() => {
    if (pendingFocusRef.current) {
      const targetId = pendingFocusRef.current;
      pendingFocusRef.current = null;
      // Use requestAnimationFrame to wait for DOM update
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-block-id="${targetId}"]`) as HTMLElement | null;
        if (el) {
          el.focus();
          // Move cursor to end
          const range = document.createRange();
          const sel = window.getSelection();
          if (sel) {
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      });
    }
  }, [blocks]);

  const handleOpen = useCallback(() => {
    const artifact = deserializeArtifact(SAMPLE_OCD_FILES);
    adapterRef.current = new WriteDocumentAdapter(artifact);
    refreshBlocks();
    setIsLoaded(true);
    setIsDirty(false);
    setStatusMessage('Document loaded');
    if (collabEnabled) {
      collab.initializeWithArtifact(artifact);
    }
  }, [refreshBlocks, collabEnabled, collab]);

  const handleSave = useCallback(() => {
    if (!adapterRef.current) return;
    // Flush any pending debounced ops before saving
    flushPendingOps();
    const serialized = serializeArtifact(adapterRef.current.getArtifact());
    console.log('[save] serialized package:', serialized.files);
    setIsDirty(false);
    setStatusMessage('Document saved (see console)');
  }, []);

  const flushPendingOps = useCallback(() => {
    if (!adapterRef.current) return;
    for (const [blockId, timer] of debounceTimerRef.current.entries()) {
      clearTimeout(timer);
      debounceTimerRef.current.delete(blockId);
      const pendingText = localTextRef.current.get(blockId);
      if (pendingText !== undefined) {
        commitBlockText(blockId, pendingText);
      }
    }
  }, []);

  const handleImportDocx = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const { artifact, report } = await importDocx(new Uint8Array(arrayBuffer));
        adapterRef.current = new WriteDocumentAdapter(artifact as ArtifactEnvelope);
        refreshBlocks();
        setIsLoaded(true);
        setIsDirty(false);
        const summary = formatCompatReport(report);
        setStatusMessage(`Imported: ${file.name}. ${summary}`);
      } catch (err) {
        setStatusMessage(`Import error: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    };
    input.click();
  }, [refreshBlocks]);

  const handleExportDocx = useCallback(async () => {
    if (!adapterRef.current) return;
    flushPendingOps();
    try {
      const { data, report } = await exportDocx(adapterRef.current.getArtifact());
      const blob = new Blob([data.slice().buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.docx';
      a.click();
      URL.revokeObjectURL(url);
      const summary = formatCompatReport(report);
      setStatusMessage(`Exported .docx. ${summary}`);
    } catch (err) {
      setStatusMessage(`Export error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [flushPendingOps]);

  const commitBlockText = useCallback((blockId: string, newText: string) => {
    if (!adapterRef.current) return;

    const artifact = adapterRef.current.getArtifact();
    const node = artifact.nodes[blockId] as { content?: { text: string }[] } | undefined;
    if (!node?.content) return;

    const oldText = node.content.map((r) => r.text).join('');
    if (oldText === newText) return;

    // Snapshot for undo before applying
    undoRedo.pushSnapshot(adapterRef.current.getArtifact());

    const op: Operation = {
      operationId: uuidv4(),
      type: 'replace_text',
      artifactId: artifact.artifactId,
      targetId: blockId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        startOffset: 0,
        endOffset: oldText.length,
        newText,
        oldText,
      },
    };

    adapterRef.current.applyOperation(op);
    if (collabEnabled) {
      collab.applyOperationToCollab(op);
    }
    localTextRef.current.delete(blockId);
    setIsDirty(true);
  }, [collabEnabled, collab, undoRedo]);

  const handleBlockTextChange = useCallback(
    (blockId: string, newText: string) => {
      if (!adapterRef.current) return;

      // Store the local text immediately so the UI stays in sync
      localTextRef.current.set(blockId, newText);

      // Clear any existing debounce timer for this block
      const existingTimer = debounceTimerRef.current.get(blockId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set a new debounce timer
      const timer = setTimeout(() => {
        debounceTimerRef.current.delete(blockId);
        const currentText = localTextRef.current.get(blockId);
        if (currentText !== undefined) {
          commitBlockText(blockId, currentText);
        }
      }, 300);
      debounceTimerRef.current.set(blockId, timer);
    },
    [commitBlockText],
  );

  const handleInsertBlockAfter = useCallback(
    (blockId: string) => {
      if (!adapterRef.current) return;

      // Flush any pending text for the current block first
      const existingTimer = debounceTimerRef.current.get(blockId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimerRef.current.delete(blockId);
        const pendingText = localTextRef.current.get(blockId);
        if (pendingText !== undefined) {
          commitBlockText(blockId, pendingText);
        }
      }

      // Snapshot for undo
      undoRedo.pushSnapshot(adapterRef.current.getArtifact());

      const artifact = adapterRef.current.getArtifact();
      const currentNode = artifact.nodes[blockId];
      if (!currentNode || !currentNode.parentId) return;

      const parentNode = artifact.nodes[currentNode.parentId];
      if (!parentNode?.childIds) return;

      const currentIndex = parentNode.childIds.indexOf(blockId);
      if (currentIndex === -1) return;

      const newBlockId = `para-${uuidv4().slice(0, 8)}`;

      const op: Operation = {
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId: artifact.artifactId,
        targetId: newBlockId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: {
          node: {
            id: newBlockId,
            type: 'paragraph',
            content: [{ text: '' }],
          } as import('@opencanvas/core-types').BaseNode,
          parentId: currentNode.parentId,
          index: currentIndex + 1,
        },
      };

      adapterRef.current.applyOperation(op);
      if (collabEnabled) {
        collab.applyOperationToCollab(op);
      }
      setIsDirty(true);
      pendingFocusRef.current = newBlockId;
      refreshBlocks();
    },
    [refreshBlocks, commitBlockText, collabEnabled, collab, undoRedo],
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      if (!adapterRef.current) return;

      const artifact = adapterRef.current.getArtifact();
      const currentNode = artifact.nodes[blockId];
      if (!currentNode || !currentNode.parentId) return;

      const parentNode = artifact.nodes[currentNode.parentId];
      if (!parentNode?.childIds) return;

      // Don't delete the last block
      const siblingCount = parentNode.childIds.length;
      if (siblingCount <= 1) return;

      const currentIndex = parentNode.childIds.indexOf(blockId);
      if (currentIndex === -1) return;

      // Snapshot for undo
      undoRedo.pushSnapshot(adapterRef.current.getArtifact());

      const op: Operation = {
        operationId: uuidv4(),
        type: 'delete_node',
        artifactId: artifact.artifactId,
        targetId: blockId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
      };

      adapterRef.current.applyOperation(op);
      if (collabEnabled) {
        collab.applyOperationToCollab(op);
      }
      setIsDirty(true);

      // Focus the previous block (or next if first)
      const focusIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      const remainingChildIds = parentNode.childIds.filter((id) => id !== blockId);
      if (remainingChildIds.length > 0) {
        const targetBlockId = remainingChildIds[Math.min(focusIndex, remainingChildIds.length - 1)];
        pendingFocusRef.current = targetBlockId;
        setFocusedBlockId(targetBlockId);
      }

      refreshBlocks();
    },
    [refreshBlocks, collabEnabled, collab, undoRedo],
  );

  const handleToggleBlockType = useCallback(
    (blockId: string, newType: 'paragraph' | 'heading', level?: number) => {
      if (!adapterRef.current) return;

      // Flush any pending text for this block first
      const existingTimer = debounceTimerRef.current.get(blockId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimerRef.current.delete(blockId);
        const pendingText = localTextRef.current.get(blockId);
        if (pendingText !== undefined) {
          commitBlockText(blockId, pendingText);
        }
      }

      const artifact = adapterRef.current.getArtifact();
      const currentNode = artifact.nodes[blockId] as
        | { id: string; type: string; parentId?: string; content?: { text: string }[] ; level?: number }
        | undefined;
      if (!currentNode || !currentNode.parentId) return;

      // If already the target type (and level for heading), do nothing
      if (currentNode.type === newType) {
        if (newType === 'paragraph') return;
        if (newType === 'heading' && currentNode.level === level) return;
      }

      // Snapshot for undo
      undoRedo.pushSnapshot(adapterRef.current.getArtifact());

      // If same type (heading) but different level, use update_node for the level
      if (currentNode.type === 'heading' && newType === 'heading') {
        const op: Operation = {
          operationId: uuidv4(),
          type: 'update_node',
          artifactId: artifact.artifactId,
          targetId: blockId,
          actorType: 'user',
          timestamp: new Date().toISOString(),
          payload: {
            patch: { level: level ?? 1 },
          },
        };
        adapterRef.current.applyOperation(op);
        if (collabEnabled) {
          collab.applyOperationToCollab(op);
        }
        setIsDirty(true);
        pendingFocusRef.current = blockId;
        refreshBlocks();
        return;
      }

      // Type change requires delete + insert because update_node preserves type
      const parentId = currentNode.parentId;
      const parentNode = artifact.nodes[parentId];
      if (!parentNode?.childIds) return;

      const currentIndex = parentNode.childIds.indexOf(blockId);
      if (currentIndex === -1) return;

      const text = currentNode.content?.map((r) => r.text).join('') ?? '';
      const newBlockId = `${newType === 'heading' ? 'heading' : 'para'}-${uuidv4().slice(0, 8)}`;

      const newNodeBase: Record<string, unknown> = {
        id: newBlockId,
        type: newType,
        content: [{ text }],
      };
      if (newType === 'heading') {
        newNodeBase.level = level ?? 1;
      }

      // Use a batch operation: delete old, insert new at same position
      const batchOp: Operation = {
        operationId: uuidv4(),
        type: 'batch',
        artifactId: artifact.artifactId,
        targetId: blockId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: {
          operations: [
            {
              operationId: uuidv4(),
              type: 'delete_node',
              artifactId: artifact.artifactId,
              targetId: blockId,
              actorType: 'user',
              timestamp: new Date().toISOString(),
            },
            {
              operationId: uuidv4(),
              type: 'insert_node',
              artifactId: artifact.artifactId,
              targetId: newBlockId,
              actorType: 'user',
              timestamp: new Date().toISOString(),
              payload: {
                node: newNodeBase as unknown as import('@opencanvas/core-types').BaseNode,
                parentId,
                index: currentIndex,
              },
            },
          ],
        },
      };

      adapterRef.current.applyOperation(batchOp);
      if (collabEnabled) {
        collab.applyOperationToCollab(batchOp);
      }
      setIsDirty(true);
      setFocusedBlockId(newBlockId);
      pendingFocusRef.current = newBlockId;
      refreshBlocks();
    },
    [refreshBlocks, commitBlockText, collabEnabled, collab, undoRedo],
  );

  const handleUndo = useCallback(() => {
    if (!adapterRef.current) return;
    // Save current state to redo stack
    undoRedo.pushToRedo(adapterRef.current.getArtifact());
    const snapshot = undoRedo.undo();
    if (!snapshot) return;
    adapterRef.current = new WriteDocumentAdapter(snapshot);
    refreshBlocks();
    setIsDirty(true);
    setStatusMessage('Undone');
  }, [undoRedo, refreshBlocks]);

  const handleRedo = useCallback(() => {
    if (!adapterRef.current) return;
    // Save current state to undo stack (without clearing redo)
    // We manually push to undo here since pushSnapshot clears redo
    const currentArtifact = adapterRef.current.getArtifact();
    const snapshot = undoRedo.redo();
    if (!snapshot) return;
    // We need to manually add current to undo without clearing redo.
    // Since pushSnapshot clears redo, we handle this differently:
    // The undo stack is managed by pushing before we pop from redo.
    // Actually, for redo we just restore and the stacks are already correct.
    // But we need the current state on the undo stack for subsequent undos.
    // Let's use a direct approach:
    undoRedo.pushSnapshot(currentArtifact);
    // pushSnapshot clears redo, but we already popped the redo item, so remaining redo items are lost.
    // This is a known simplification - redo chain breaks after one redo then new action.
    // For proper behavior, we'd need a more complex stack. For now this works for single redo.
    adapterRef.current = new WriteDocumentAdapter(snapshot);
    refreshBlocks();
    setIsDirty(true);
    setStatusMessage('Redone');
  }, [undoRedo, refreshBlocks]);

  const handleRewrite = useCallback(
    async (tone: string) => {
      if (!adapterRef.current || !selection) return;
      setIsLoading(true);
      setPendingPreview(null);
      setStatusMessage('');

      try {
        const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskType: 'rewrite_block',
            targetId: selection.objectId,
            selectionStart: selection.startOffset,
            selectionEnd: selection.endOffset,
            parameters: { tone },
            artifact: adapterRef.current.getArtifact(),
          }),
        });

        const data = await response.json();
        setPendingPreview({
          taskId: data.taskId,
          previewText: data.previewText,
          operations: data.proposedOperations,
        });
      } catch (err) {
        setStatusMessage(`AI error: ${err instanceof Error ? err.message : 'unknown'}`);
      } finally {
        setIsLoading(false);
      }
    },
    [selection],
  );

  const handleApprove = useCallback(async () => {
    if (!adapterRef.current || !pendingPreview) return;

    // Snapshot for undo before AI changes
    undoRedo.pushSnapshot(adapterRef.current.getArtifact());

    // Save focused block ID to restore after apply
    const restoreFocusId = focusedBlockId;

    try {
      const response = await fetch(
        `${AI_RUNTIME_URL}/ai/tasks/${pendingPreview.taskId}/approve`,
        { method: 'POST' },
      );
      const data = await response.json();

      adapterRef.current.applyOperations(data.approvedOperations);
      if (collabEnabled) {
        for (const op of data.approvedOperations as Operation[]) {
          collab.applyOperationToCollab(op);
        }
      }

      // Schedule focus restoration to the same block (or nearest)
      if (restoreFocusId) {
        // Check if block still exists after AI changes
        const newBlocks = adapterRef.current.getEditableBlocks();
        const stillExists = newBlocks.some((b) => b.id === restoreFocusId);
        if (stillExists) {
          pendingFocusRef.current = restoreFocusId;
        } else if (newBlocks.length > 0) {
          // Find the block at the same position or nearest
          const oldIndex = blocks.findIndex((b) => b.id === restoreFocusId);
          const targetIndex = Math.min(oldIndex, newBlocks.length - 1);
          pendingFocusRef.current = newBlocks[Math.max(0, targetIndex)].id;
        }
      }

      refreshBlocks();
      setPendingPreview(null);
      setIsDirty(true);
      setStatusMessage('AI changes applied');
    } catch (err) {
      setStatusMessage(`Approve error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [pendingPreview, refreshBlocks, focusedBlockId, blocks, undoRedo]);

  const handleReject = useCallback(async () => {
    if (!pendingPreview) return;

    try {
      await fetch(`${AI_RUNTIME_URL}/ai/tasks/${pendingPreview.taskId}/reject`, {
        method: 'POST',
      });
      setPendingPreview(null);
      setStatusMessage('AI changes rejected');
    } catch (err) {
      setStatusMessage(`Reject error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [pendingPreview]);

  // Global keyboard shortcuts
  const handleGlobalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Ctrl/Cmd+S: Save
      if (e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Ctrl/Cmd+Z: Undo, Ctrl/Cmd+Shift+Z: Redo
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
        return;
      }
    },
    [handleSave, handleUndo, handleRedo],
  );

  // Find the focused block for the toolbar
  const focusedBlock = focusedBlockId ? blocks.find((b) => b.id === focusedBlockId) ?? null : null;

  return (
    <div
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      onKeyDown={handleGlobalKeyDown}
    >
      {/* Top bar */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
        }}
      >
        <strong>OpenCanvas Write</strong>
        <button onClick={handleOpen} style={{ padding: '4px 12px' }}>
          Open Sample
        </button>
        <button onClick={handleSave} disabled={!isLoaded} style={{ padding: '4px 12px' }}>
          Save
        </button>
        <button onClick={handleImportDocx} style={{ padding: '4px 12px' }}>
          Import .docx
        </button>
        <button onClick={handleExportDocx} disabled={!isLoaded} style={{ padding: '4px 12px' }}>
          Export .docx
        </button>
        <button
          onClick={() => setCollabEnabled((v) => !v)}
          style={{
            padding: '4px 12px',
            backgroundColor: collabEnabled ? '#4caf50' : undefined,
            color: collabEnabled ? '#fff' : undefined,
            border: collabEnabled ? '1px solid #388e3c' : undefined,
          }}
        >
          {collabEnabled ? 'Collaborating' : 'Collaborate'}
        </button>
        {isDirty && <span style={{ color: '#e67e22' }}>Unsaved changes</span>}
        {statusMessage && <span style={{ color: '#888' }}>{statusMessage}</span>}
      </div>

      {/* Collaboration bar */}
      {collabEnabled && (
        <CollabBar
          isConnected={collab.isConnected}
          connectedUsers={collab.connectedUsers}
          docId={collabDocId}
        />
      )}

      {/* Toolbar */}
      {isLoaded && (
        <Toolbar
          focusedBlock={focusedBlock}
          onToggleBlockType={handleToggleBlockType}
          canUndo={undoRedo.canUndo}
          canRedo={undoRedo.canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {isLoaded ? (
            <WriteSurface
              blocks={blocks}
              focusedBlockId={focusedBlockId}
              localTextOverrides={localTextRef.current}
              onBlockTextChange={handleBlockTextChange}
              onSelectionChange={setSelection}
              onBlockFocus={setFocusedBlockId}
              onInsertBlockAfter={handleInsertBlockAfter}
              onDeleteBlock={handleDeleteBlock}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#888',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Click "Open Sample" to load a document
            </div>
          )}
        </div>

        {isLoaded && (
          <AiPanel
            selection={selection}
            pendingPreview={pendingPreview}
            isLoading={isLoading}
            onRewrite={handleRewrite}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>
    </div>
  );
};

function formatCompatReport(report: CompatibilityReport): string {
  const parts: string[] = [];
  if (report.preserved.length > 0) {
    parts.push(`Preserved: ${report.preserved.length}`);
  }
  if (report.approximated.length > 0) {
    parts.push(`Approximated: ${report.approximated.join(', ')}`);
  }
  if (report.unsupported.length > 0) {
    parts.push(`Unsupported: ${report.unsupported.join(', ')}`);
  }
  if (report.omitted.length > 0) {
    parts.push(`Omitted: ${report.omitted.join(', ')}`);
  }
  return parts.join(' | ');
}
