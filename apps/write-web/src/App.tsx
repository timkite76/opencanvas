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
import { StatusBar } from './components/StatusBar.js';
import { FindReplace } from './components/FindReplace.js';
import { FloatingActions } from './components/FloatingActions.js';
import { ActionLog } from './components/ActionLog.js';
import { FunctionBrowser } from './components/FunctionBrowser.js';
import type { FindMatch } from './components/BlockEditor.js';
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

  // Find & Replace state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findSearchTerm, setFindSearchTerm] = useState('');
  const [findReplaceTerm, setFindReplaceTerm] = useState('');
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [findCurrentIndex, setFindCurrentIndex] = useState(0);

  // Inline completion (ghost text) state
  const [completionBlockId, setCompletionBlockId] = useState<string | null>(null);
  const [completionText, setCompletionText] = useState<string>('');
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleCompletionRef = useRef<((blockId: string, text: string) => void) | null>(null);

  // Floating toolbar state
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const [floatingActionLoading, setFloatingActionLoading] = useState(false);

  // AI Log & Function Browser panels
  const [showActionLog, setShowActionLog] = useState(false);
  const [showFunctionBrowser, setShowFunctionBrowser] = useState(false);

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

      // Schedule inline completion after typing pause
      scheduleCompletionRef.current?.(blockId, newText);
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

  const handleToggleList = useCallback(
    (blockId: string, listType: 'bullet' | 'ordered') => {
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
        | { id: string; type: string; parentId?: string; content?: { text: string }[]; level?: number; listType?: string }
        | undefined;
      if (!currentNode || !currentNode.parentId) return;

      const parentNode = artifact.nodes[currentNode.parentId];
      if (!parentNode?.childIds) return;

      // Snapshot for undo
      undoRedo.pushSnapshot(adapterRef.current.getArtifact());

      const parentId = currentNode.parentId;
      const currentIndex = parentNode.childIds.indexOf(blockId);
      if (currentIndex === -1) return;

      const text = currentNode.content?.map((r) => r.text).join('') ?? '';

      if (currentNode.type === 'list_item') {
        // Already a list item
        const parentListNode = artifact.nodes[parentId] as { type: string; listType?: string; parentId?: string; childIds?: string[] } | undefined;

        if (parentListNode?.type === 'list' && parentListNode.listType === listType) {
          // Same type: unwrap back to paragraph
          const grandparentId = parentListNode.parentId;
          if (!grandparentId) return;
          const grandparent = artifact.nodes[grandparentId];
          if (!grandparent?.childIds) return;

          const listIndexInGrandparent = grandparent.childIds.indexOf(parentId);
          if (listIndexInGrandparent === -1) return;

          const newBlockId = `para-${uuidv4().slice(0, 8)}`;
          const ops: Operation[] = [];

          // Delete the list_item from the list
          ops.push({
            operationId: uuidv4(),
            type: 'delete_node',
            artifactId: artifact.artifactId,
            targetId: blockId,
            actorType: 'user',
            timestamp: new Date().toISOString(),
          });

          // If this was the only child, delete the list parent too
          const siblings = parentListNode.childIds ?? [];
          if (siblings.length <= 1) {
            ops.push({
              operationId: uuidv4(),
              type: 'delete_node',
              artifactId: artifact.artifactId,
              targetId: parentId,
              actorType: 'user',
              timestamp: new Date().toISOString(),
            });
          }

          // Insert the new paragraph in the grandparent at the list's position
          ops.push({
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
                content: [{ text }],
              } as import('@opencanvas/core-types').BaseNode,
              parentId: grandparentId,
              index: listIndexInGrandparent,
            },
          });

          const batchOp: Operation = {
            operationId: uuidv4(),
            type: 'batch',
            artifactId: artifact.artifactId,
            targetId: blockId,
            actorType: 'user',
            timestamp: new Date().toISOString(),
            payload: { operations: ops },
          };

          adapterRef.current.applyOperation(batchOp);
          if (collabEnabled) {
            collab.applyOperationToCollab(batchOp);
          }
          setIsDirty(true);
          setFocusedBlockId(newBlockId);
          pendingFocusRef.current = newBlockId;
          refreshBlocks();
          return;
        }

        // Different list type: change the parent list's listType
        if (parentListNode?.type === 'list') {
          const op: Operation = {
            operationId: uuidv4(),
            type: 'update_node',
            artifactId: artifact.artifactId,
            targetId: parentId,
            actorType: 'user',
            timestamp: new Date().toISOString(),
            payload: {
              patch: { listType },
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
      }

      // Current block is a paragraph or heading: wrap in a new list
      const newListId = `list-${uuidv4().slice(0, 8)}`;
      const newListItemId = `li-${uuidv4().slice(0, 8)}`;

      const ops: Operation[] = [
        // Delete the current block
        {
          operationId: uuidv4(),
          type: 'delete_node',
          artifactId: artifact.artifactId,
          targetId: blockId,
          actorType: 'user',
          timestamp: new Date().toISOString(),
        },
        // Insert a list node at the same position
        {
          operationId: uuidv4(),
          type: 'insert_node',
          artifactId: artifact.artifactId,
          targetId: newListId,
          actorType: 'user',
          timestamp: new Date().toISOString(),
          payload: {
            node: {
              id: newListId,
              type: 'list',
              listType,
            } as unknown as import('@opencanvas/core-types').BaseNode,
            parentId,
            index: currentIndex,
          },
        },
        // Insert a list_item inside the list
        {
          operationId: uuidv4(),
          type: 'insert_node',
          artifactId: artifact.artifactId,
          targetId: newListItemId,
          actorType: 'user',
          timestamp: new Date().toISOString(),
          payload: {
            node: {
              id: newListItemId,
              type: 'list_item',
              content: [{ text }],
            } as unknown as import('@opencanvas/core-types').BaseNode,
            parentId: newListId,
            index: 0,
          },
        },
      ];

      const batchOp: Operation = {
        operationId: uuidv4(),
        type: 'batch',
        artifactId: artifact.artifactId,
        targetId: blockId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: { operations: ops },
      };

      adapterRef.current.applyOperation(batchOp);
      if (collabEnabled) {
        collab.applyOperationToCollab(batchOp);
      }
      setIsDirty(true);
      setFocusedBlockId(newListItemId);
      pendingFocusRef.current = newListItemId;
      refreshBlocks();
    },
    [refreshBlocks, commitBlockText, collabEnabled, collab, undoRedo],
  );

  const handleInsertListItemAfter = useCallback(
    (blockId: string, listType: 'bullet' | 'ordered') => {
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

      const newListItemId = `li-${uuidv4().slice(0, 8)}`;

      const op: Operation = {
        operationId: uuidv4(),
        type: 'insert_node',
        artifactId: artifact.artifactId,
        targetId: newListItemId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: {
          node: {
            id: newListItemId,
            type: 'list_item',
            content: [{ text: '' }],
          } as unknown as import('@opencanvas/core-types').BaseNode,
          parentId: currentNode.parentId,
          index: currentIndex + 1,
        },
      };

      adapterRef.current.applyOperation(op);
      if (collabEnabled) {
        collab.applyOperationToCollab(op);
      }
      setIsDirty(true);
      pendingFocusRef.current = newListItemId;
      refreshBlocks();
    },
    [refreshBlocks, commitBlockText, collabEnabled, collab, undoRedo],
  );

  const handleConvertToParagraph = useCallback(
    (blockId: string) => {
      if (!adapterRef.current) return;

      const artifact = adapterRef.current.getArtifact();
      const currentNode = artifact.nodes[blockId] as
        | { id: string; type: string; parentId?: string; content?: { text: string }[] }
        | undefined;
      if (!currentNode || !currentNode.parentId) return;

      const listParent = artifact.nodes[currentNode.parentId] as
        | { id: string; type: string; parentId?: string; childIds?: string[] }
        | undefined;
      if (!listParent || listParent.type !== 'list' || !listParent.parentId) return;

      const grandparentId = listParent.parentId;
      const grandparent = artifact.nodes[grandparentId];
      if (!grandparent?.childIds) return;

      const listIndexInGrandparent = grandparent.childIds.indexOf(listParent.id);
      if (listIndexInGrandparent === -1) return;

      // Snapshot for undo
      undoRedo.pushSnapshot(adapterRef.current.getArtifact());

      const text = currentNode.content?.map((r) => r.text).join('') ?? '';
      const newBlockId = `para-${uuidv4().slice(0, 8)}`;
      const ops: Operation[] = [];

      // Delete the list_item
      ops.push({
        operationId: uuidv4(),
        type: 'delete_node',
        artifactId: artifact.artifactId,
        targetId: blockId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
      });

      // If this was the only child, delete the list parent too
      const siblings = listParent.childIds ?? [];
      if (siblings.length <= 1) {
        ops.push({
          operationId: uuidv4(),
          type: 'delete_node',
          artifactId: artifact.artifactId,
          targetId: listParent.id,
          actorType: 'user',
          timestamp: new Date().toISOString(),
        });
      }

      // Insert paragraph at the list's position in the grandparent
      ops.push({
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
            content: [{ text }],
          } as import('@opencanvas/core-types').BaseNode,
          parentId: grandparentId,
          index: listIndexInGrandparent,
        },
      });

      const batchOp: Operation = {
        operationId: uuidv4(),
        type: 'batch',
        artifactId: artifact.artifactId,
        targetId: blockId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: { operations: ops },
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
    [refreshBlocks, collabEnabled, collab, undoRedo],
  );

  // Compute find matches from current blocks and search term
  const findMatches = useMemo((): FindMatch[] => {
    if (!findSearchTerm || findSearchTerm.length === 0) return [];
    const matches: FindMatch[] = [];
    const term = findCaseSensitive ? findSearchTerm : findSearchTerm.toLowerCase();
    for (const block of blocks) {
      const text = findCaseSensitive ? block.text : block.text.toLowerCase();
      let searchFrom = 0;
      while (searchFrom < text.length) {
        const idx = text.indexOf(term, searchFrom);
        if (idx === -1) break;
        matches.push({
          blockId: block.id,
          startOffset: idx,
          endOffset: idx + findSearchTerm.length,
        });
        searchFrom = idx + 1;
      }
    }
    return matches;
  }, [blocks, findSearchTerm, findCaseSensitive]);

  // Clamp current match index when matches change
  useEffect(() => {
    if (findMatches.length === 0) {
      setFindCurrentIndex(0);
    } else if (findCurrentIndex >= findMatches.length) {
      setFindCurrentIndex(0);
    }
  }, [findMatches.length]);

  const handleFindNext = useCallback(() => {
    if (findMatches.length === 0) return;
    setFindCurrentIndex((prev) => (prev + 1) % findMatches.length);
  }, [findMatches.length]);

  const handleFindPrevious = useCallback(() => {
    if (findMatches.length === 0) return;
    setFindCurrentIndex((prev) => (prev - 1 + findMatches.length) % findMatches.length);
  }, [findMatches.length]);

  const handleFindReplace = useCallback(() => {
    if (!adapterRef.current || findMatches.length === 0) return;
    const match = findMatches[findCurrentIndex];
    if (!match) return;

    const artifact = adapterRef.current.getArtifact();
    const node = artifact.nodes[match.blockId] as { content?: { text: string }[] } | undefined;
    if (!node?.content) return;

    const oldText = node.content.map((r) => r.text).join('');
    const before = oldText.slice(0, match.startOffset);
    const after = oldText.slice(match.endOffset);
    const newText = before + findReplaceTerm + after;

    // Snapshot for undo
    undoRedo.pushSnapshot(adapterRef.current.getArtifact());

    const op: Operation = {
      operationId: uuidv4(),
      type: 'replace_text',
      artifactId: artifact.artifactId,
      targetId: match.blockId,
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
    setIsDirty(true);
    refreshBlocks();
  }, [findMatches, findCurrentIndex, findReplaceTerm, collabEnabled, collab, undoRedo, refreshBlocks]);

  const handleFindReplaceAll = useCallback(() => {
    if (!adapterRef.current || findMatches.length === 0) return;

    // Snapshot for undo
    undoRedo.pushSnapshot(adapterRef.current.getArtifact());

    // Group matches by block, process in reverse offset order to preserve positions
    const matchesByBlock = new Map<string, FindMatch[]>();
    for (const match of findMatches) {
      const existing = matchesByBlock.get(match.blockId) ?? [];
      existing.push(match);
      matchesByBlock.set(match.blockId, existing);
    }

    const ops: Operation[] = [];
    const artifact = adapterRef.current.getArtifact();

    for (const [blockId, blockMatches] of matchesByBlock.entries()) {
      const node = artifact.nodes[blockId] as { content?: { text: string }[] } | undefined;
      if (!node?.content) continue;

      const oldText = node.content.map((r) => r.text).join('');
      // Apply replacements from end to start so offsets remain valid
      const sorted = [...blockMatches].sort((a, b) => b.startOffset - a.startOffset);
      let newText = oldText;
      for (const match of sorted) {
        newText = newText.slice(0, match.startOffset) + findReplaceTerm + newText.slice(match.endOffset);
      }

      ops.push({
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
      });
    }

    if (ops.length === 1) {
      adapterRef.current.applyOperation(ops[0]);
      if (collabEnabled) {
        collab.applyOperationToCollab(ops[0]);
      }
    } else if (ops.length > 1) {
      const batchOp: Operation = {
        operationId: uuidv4(),
        type: 'batch',
        artifactId: artifact.artifactId,
        targetId: ops[0].targetId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: { operations: ops },
      };
      adapterRef.current.applyOperation(batchOp);
      if (collabEnabled) {
        collab.applyOperationToCollab(batchOp);
      }
    }

    setIsDirty(true);
    setFindCurrentIndex(0);
    refreshBlocks();
  }, [findMatches, findReplaceTerm, collabEnabled, collab, undoRedo, refreshBlocks]);

  const handleCloseFindReplace = useCallback(() => {
    setShowFindReplace(false);
    setFindSearchTerm('');
    setFindReplaceTerm('');
    setFindCurrentIndex(0);
  }, []);

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

  // --- Inline Completion (Ghost Text) ---

  const requestCompletion = useCallback(
    async (blockId: string, text: string, cursorOffset: number) => {
      if (!adapterRef.current || !text.trim()) return;

      try {
        // Gather full document text for context
        const allBlocks = adapterRef.current.getEditableBlocks();
        const contextText = allBlocks.map((b) => b.text).join('\n');

        const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskType: 'complete_text',
            targetId: blockId,
            parameters: { cursorOffset, contextText },
            artifact: adapterRef.current.getArtifact(),
          }),
        });

        if (!response.ok) return;
        const data = await response.json();
        const completion = data.previewText ?? data.output?.completion ?? '';

        if (completion && completion.length > 0) {
          setCompletionBlockId(blockId);
          setCompletionText(completion);
        }
      } catch {
        // Silently fail - completion is a nice-to-have
      }
    },
    [],
  );

  const handleAcceptCompletion = useCallback(
    (blockId: string) => {
      if (!adapterRef.current || !completionText || completionBlockId !== blockId) return;

      const artifact = adapterRef.current.getArtifact();
      const node = artifact.nodes[blockId] as { content?: { text: string }[] } | undefined;
      if (!node?.content) return;

      const oldText = node.content.map((r) => r.text).join('');
      const newText = oldText + completionText;

      // Snapshot for undo
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

      setCompletionBlockId(null);
      setCompletionText('');
      setIsDirty(true);
      pendingFocusRef.current = blockId;
      refreshBlocks();
    },
    [completionText, completionBlockId, collabEnabled, collab, undoRedo, refreshBlocks],
  );

  const handleDismissCompletion = useCallback(
    (_blockId: string) => {
      setCompletionBlockId(null);
      setCompletionText('');
    },
    [],
  );

  // Trigger completion timer on text changes
  const scheduleCompletion = useCallback(
    (blockId: string, text: string) => {
      // Clear any existing timer
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
      // Dismiss existing completion
      setCompletionBlockId(null);
      setCompletionText('');

      // Schedule a new completion request after 1.5s pause
      completionTimerRef.current = setTimeout(() => {
        completionTimerRef.current = null;
        requestCompletion(blockId, text, text.length);
      }, 1500);
    },
    [requestCompletion],
  );
  scheduleCompletionRef.current = scheduleCompletion;

  // --- Floating Toolbar Actions ---

  const handleFloatingAction = useCallback(
    async (action: string) => {
      if (!adapterRef.current || !selection) return;

      setFloatingActionLoading(true);

      // Map floating actions to AI runtime task types
      const actionToTask: Record<string, { taskType: string; parameters: Record<string, unknown> }> = {
        rewrite: { taskType: 'rewrite_block', parameters: { tone: 'executive' } },
        expand: { taskType: 'rewrite_block', parameters: { tone: 'formal', instructions: 'expand' } },
        condense: { taskType: 'rewrite_block', parameters: { tone: 'concise' } },
        fix_grammar: { taskType: 'improve_writing', parameters: {} },
        simplify: { taskType: 'rewrite_block', parameters: { tone: 'friendly' } },
      };

      const taskConfig = actionToTask[action];
      if (!taskConfig) {
        setFloatingActionLoading(false);
        return;
      }

      try {
        const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskType: taskConfig.taskType,
            targetId: selection.objectId,
            selectionStart: selection.startOffset,
            selectionEnd: selection.endOffset,
            parameters: taskConfig.parameters,
            artifact: adapterRef.current.getArtifact(),
          }),
        });

        const data = await response.json();
        setPendingPreview({
          taskId: data.taskId,
          previewText: data.previewText,
          operations: data.proposedOperations,
        });
        setShowFloatingActions(false);
      } catch (err) {
        setStatusMessage(`AI error: ${err instanceof Error ? err.message : 'unknown'}`);
      } finally {
        setFloatingActionLoading(false);
      }
    },
    [selection],
  );

  // Track text selection for the floating toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        setShowFloatingActions(true);
      } else {
        setShowFloatingActions(false);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // --- Document-level AI Actions ---

  const handleSummarize = useCallback(async () => {
    if (!adapterRef.current) return;
    setIsLoading(true);
    setPendingPreview(null);

    try {
      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'summarize_document',
          targetId: adapterRef.current.getArtifact().rootNodeId,
          parameters: {},
          artifact: adapterRef.current.getArtifact(),
        }),
      });

      const data = await response.json();
      if (data.error) {
        setStatusMessage(`Summarize error: ${data.error}`);
      } else {
        setPendingPreview({
          taskId: data.taskId,
          previewText: data.previewText,
          operations: data.proposedOperations,
        });
      }
    } catch (err) {
      setStatusMessage(`AI error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleExtractActions = useCallback(async () => {
    if (!adapterRef.current) return;
    setIsLoading(true);
    setPendingPreview(null);

    try {
      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'extract_action_items',
          targetId: adapterRef.current.getArtifact().rootNodeId,
          parameters: {},
          artifact: adapterRef.current.getArtifact(),
        }),
      });

      const data = await response.json();
      if (data.error) {
        setStatusMessage(`Extract actions error: ${data.error}`);
      } else {
        setPendingPreview({
          taskId: data.taskId,
          previewText: data.previewText,
          operations: data.proposedOperations,
        });
      }
    } catch (err) {
      setStatusMessage(`AI error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleImproveWriting = useCallback(async () => {
    if (!adapterRef.current || !selection) return;
    setIsLoading(true);
    setPendingPreview(null);

    try {
      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'improve_writing',
          targetId: selection.objectId,
          parameters: {},
          artifact: adapterRef.current.getArtifact(),
        }),
      });

      const data = await response.json();
      if (data.error) {
        setStatusMessage(`Writing review error: ${data.error}`);
      } else {
        setPendingPreview({
          taskId: data.taskId,
          previewText: data.previewText,
          operations: data.proposedOperations ?? [],
        });
      }
    } catch (err) {
      setStatusMessage(`AI error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setIsLoading(false);
    }
  }, [selection]);

  const handleContinueWriting = useCallback(async () => {
    if (!adapterRef.current || !selection) return;
    setIsLoading(true);
    setPendingPreview(null);

    try {
      const allBlocks = adapterRef.current.getEditableBlocks();
      const contextText = allBlocks.map((b) => b.text).join('\n');

      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'complete_text',
          targetId: selection.objectId,
          parameters: { cursorOffset: contextText.length, contextText },
          artifact: adapterRef.current.getArtifact(),
        }),
      });

      const data = await response.json();
      if (data.error) {
        setStatusMessage(`Continue writing error: ${data.error}`);
      } else {
        const completion = data.previewText ?? '';
        setPendingPreview({
          taskId: data.taskId,
          previewText: completion,
          operations: data.proposedOperations ?? [],
        });
      }
    } catch (err) {
      setStatusMessage(`AI error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setIsLoading(false);
    }
  }, [selection]);

  const handleGenerateOutline = useCallback(async (topic: string) => {
    if (!adapterRef.current) return;
    setIsLoading(true);
    setPendingPreview(null);

    try {
      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'generate_outline',
          targetId: adapterRef.current.getArtifact().rootNodeId,
          parameters: { topic },
          artifact: adapterRef.current.getArtifact(),
        }),
      });

      const data = await response.json();
      if (data.error) {
        setStatusMessage(`Outline generation error: ${data.error}`);
      } else {
        setPendingPreview({
          taskId: data.taskId,
          previewText: data.previewText,
          operations: data.proposedOperations,
        });
      }
    } catch (err) {
      setStatusMessage(`AI error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Global keyboard shortcuts
  const handleGlobalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Ctrl/Cmd+F: Find & Replace
      if (e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
        return;
      }

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

  // Shared top-bar button styles
  const topBtnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    backgroundColor: '#ffffff',
    color: '#374151',
    transition: 'background-color 0.15s, border-color 0.15s',
    lineHeight: '20px',
    whiteSpace: 'nowrap' as const,
  };

  const topBtnDisabled: React.CSSProperties = {
    ...topBtnBase,
    opacity: 0.4,
    cursor: 'default',
  };

  const collabBtnStyle: React.CSSProperties = collabEnabled
    ? { ...topBtnBase, backgroundColor: '#d1fae5', color: '#059669', borderColor: '#6ee7b7' }
    : topBtnBase;

  return (
    <div
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Inter", system-ui, -apple-system, sans-serif' }}
      onKeyDown={handleGlobalKeyDown}
    >
      {/* Top bar */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #e2e5e9',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          backgroundColor: '#ffffff',
          flexShrink: 0,
        }}
      >
        {/* App icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            W
          </div>
          <span style={{ fontWeight: 600, color: '#111827', fontSize: 15, whiteSpace: 'nowrap' }}>Write</span>
        </div>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button onClick={handleOpen} style={topBtnBase} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}>
          New
        </button>
        <button onClick={handleSave} disabled={!isLoaded} style={isLoaded ? topBtnBase : topBtnDisabled} onMouseEnter={(e) => { if (isLoaded) e.currentTarget.style.backgroundColor = '#f3f4f6'; }} onMouseLeave={(e) => { if (isLoaded) e.currentTarget.style.backgroundColor = '#ffffff'; }}>
          Save
        </button>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button onClick={handleImportDocx} style={topBtnBase} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}>
          Import
        </button>
        <button onClick={handleExportDocx} disabled={!isLoaded} style={isLoaded ? topBtnBase : topBtnDisabled} onMouseEnter={(e) => { if (isLoaded) e.currentTarget.style.backgroundColor = '#f3f4f6'; }} onMouseLeave={(e) => { if (isLoaded) e.currentTarget.style.backgroundColor = '#ffffff'; }}>
          Export
        </button>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button
          onClick={() => { setShowActionLog((v) => !v); setShowFunctionBrowser(false); }}
          style={showActionLog ? { ...topBtnBase, backgroundColor: '#ede9fe', color: '#7c3aed', borderColor: '#c4b5fd' } : topBtnBase}
          onMouseEnter={(e) => { if (!showActionLog) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (!showActionLog) e.currentTarget.style.backgroundColor = '#ffffff'; }}
        >
          AI Log
        </button>
        <button
          onClick={() => { setShowFunctionBrowser((v) => !v); setShowActionLog(false); }}
          style={showFunctionBrowser ? { ...topBtnBase, backgroundColor: '#dbeafe', color: '#2563eb', borderColor: '#93c5fd' } : topBtnBase}
          onMouseEnter={(e) => { if (!showFunctionBrowser) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (!showFunctionBrowser) e.currentTarget.style.backgroundColor = '#ffffff'; }}
        >
          Functions
        </button>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button
          onClick={() => setCollabEnabled((v) => !v)}
          style={collabBtnStyle}
          onMouseEnter={(e) => { if (!collabEnabled) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (!collabEnabled) e.currentTarget.style.backgroundColor = '#ffffff'; }}
        >
          {collabEnabled ? 'Collaborating' : 'Collaborate'}
        </button>

        {/* Status area - right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDirty && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', fontSize: 12, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#d97706', display: 'inline-block' }} />
              Unsaved
            </span>
          )}
          {statusMessage && (
            <span style={{ color: '#9ca3af', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statusMessage}</span>
          )}
        </div>
      </div>

      {/* Collaboration bar */}
      {collabEnabled && (
        <CollabBar
          isConnected={collab.isConnected}
          connectedUsers={collab.connectedUsers}
          docId={collabDocId}
        />
      )}

      {/* Find & Replace panel */}
      {showFindReplace && isLoaded && (
        <FindReplace
          searchTerm={findSearchTerm}
          replaceTerm={findReplaceTerm}
          caseSensitive={findCaseSensitive}
          matchCount={findMatches.length}
          currentMatchIndex={findCurrentIndex}
          onSearchChange={setFindSearchTerm}
          onReplaceChange={setFindReplaceTerm}
          onCaseSensitiveToggle={() => setFindCaseSensitive((v) => !v)}
          onFindNext={handleFindNext}
          onFindPrevious={handleFindPrevious}
          onReplace={handleFindReplace}
          onReplaceAll={handleFindReplaceAll}
          onClose={handleCloseFindReplace}
        />
      )}

      {/* Toolbar */}
      {isLoaded && (
        <Toolbar
          focusedBlock={focusedBlock}
          onToggleBlockType={handleToggleBlockType}
          onToggleList={handleToggleList}
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
              onInsertListItemAfter={handleInsertListItemAfter}
              onConvertToParagraph={handleConvertToParagraph}
              findMatches={showFindReplace ? findMatches : undefined}
              currentMatchIndex={showFindReplace ? findCurrentIndex : undefined}
              completionBlockId={completionBlockId}
              completionText={completionText}
              onAcceptCompletion={handleAcceptCompletion}
              onDismissCompletion={handleDismissCompletion}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9ca3af',
                fontFamily: "'Inter', system-ui, sans-serif",
                gap: 12,
              }}
            >
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: '#3b82f6',
              }}>
                ✏️
              </div>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#6b7280' }}>No document open</span>
              <span style={{ fontSize: 13 }}>Click "New" to create a document, or "Import" to open a .docx file</span>
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
            onSummarize={handleSummarize}
            onExtractActions={handleExtractActions}
            onImproveWriting={handleImproveWriting}
            onContinueWriting={handleContinueWriting}
            onGenerateOutline={handleGenerateOutline}
          />
        )}
      </div>

      {/* Floating AI actions toolbar */}
      {isLoaded && (
        <FloatingActions
          isVisible={showFloatingActions && !pendingPreview}
          onAction={handleFloatingAction}
          isLoading={floatingActionLoading}
        />
      )}

      {/* Status bar */}
      {isLoaded && (
        <StatusBar
          blocks={blocks}
          focusedBlock={focusedBlock}
          isDirty={isDirty}
        />
      )}

      {/* Slide-out panels */}
      <ActionLog isOpen={showActionLog} onClose={() => setShowActionLog(false)} />
      <FunctionBrowser isOpen={showFunctionBrowser} onClose={() => setShowFunctionBrowser(false)} />
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
