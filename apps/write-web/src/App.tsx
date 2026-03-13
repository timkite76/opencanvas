import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { deserializeArtifact, serializeArtifact } from '@opencanvas/core-format';
import { WriteDocumentAdapter, type CanonicalSelection, type EditableBlock } from '@opencanvas/write-editor';
import { SAMPLE_OCD_FILES } from './sample-data/sample-prd.js';
import { WriteSurface } from './components/WriteSurface.js';
import { AiPanel } from './components/AiPanel.js';
import { Toolbar } from './components/Toolbar.js';

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
  }, [refreshBlocks]);

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

  const commitBlockText = useCallback((blockId: string, newText: string) => {
    if (!adapterRef.current) return;

    const artifact = adapterRef.current.getArtifact();
    const node = artifact.nodes[blockId] as { content?: { text: string }[] } | undefined;
    if (!node?.content) return;

    const oldText = node.content.map((r) => r.text).join('');
    if (oldText === newText) return;

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
    localTextRef.current.delete(blockId);
    setIsDirty(true);
  }, []);

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
      setIsDirty(true);
      pendingFocusRef.current = newBlockId;
      refreshBlocks();
    },
    [refreshBlocks, commitBlockText],
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
      setIsDirty(true);
      setFocusedBlockId(newBlockId);
      pendingFocusRef.current = newBlockId;
      refreshBlocks();
    },
    [refreshBlocks, commitBlockText],
  );

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

    // Save focused block ID to restore after apply
    const restoreFocusId = focusedBlockId;

    try {
      const response = await fetch(
        `${AI_RUNTIME_URL}/ai/tasks/${pendingPreview.taskId}/approve`,
        { method: 'POST' },
      );
      const data = await response.json();

      adapterRef.current.applyOperations(data.approvedOperations);

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
  }, [pendingPreview, refreshBlocks, focusedBlockId, blocks]);

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

  // Find the focused block for the toolbar
  const focusedBlock = focusedBlockId ? blocks.find((b) => b.id === focusedBlockId) ?? null : null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
        {isDirty && <span style={{ color: '#e67e22' }}>Unsaved changes</span>}
        {statusMessage && <span style={{ color: '#888' }}>{statusMessage}</span>}
      </div>

      {/* Toolbar */}
      {isLoaded && (
        <Toolbar
          focusedBlock={focusedBlock}
          onToggleBlockType={handleToggleBlockType}
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
