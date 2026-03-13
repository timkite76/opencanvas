import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode, SlideNode } from '@opencanvas/deck-model';
import { buildSlideIndex } from '@opencanvas/deck-model';
import type { PresentationService } from '../services/presentation-service.js';
import { useUndoRedoManager } from '../hooks/useUndoRedo.js';
import { SlideThumbnailPane } from './SlideThumbnailPane.js';
import { SlideCanvas } from './SlideCanvas.js';
import { ObjectToolbar } from './ObjectToolbar.js';
import { DeckAiPanel } from './DeckAiPanel.js';

interface DeckShellProps {
  artifact: ArtifactEnvelope<DeckNode>;
  service: PresentationService;
  onArtifactChange: (artifact: ArtifactEnvelope<DeckNode>) => void;
  onSave?: () => void;
}

const AI_RUNTIME_URL = 'http://localhost:4001';

export const DeckShell: React.FC<DeckShellProps> = ({
  artifact,
  service,
  onArtifactChange,
  onSave,
}) => {
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPreviewText, setAiPreviewText] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const undoRedo = useUndoRedoManager();

  const slideIndex = useMemo(() => buildSlideIndex(artifact.nodes, artifact.rootNodeId), [artifact.nodes, artifact.rootNodeId]);

  const slideIds = useMemo(() => {
    const root = artifact.nodes[artifact.rootNodeId];
    return root?.childIds ?? [];
  }, [artifact.nodes, artifact.rootNodeId]);

  // Auto-select first slide
  const effectiveSlideId = selectedSlideId && slideIndex.slideById[selectedSlideId]
    ? selectedSlideId
    : slideIds[0] ?? null;

  const handleSlideSelect = useCallback((slideId: string) => {
    setSelectedSlideId(slideId);
    setSelectedObjectId(null);
    setAiPreviewText(null);
    setPendingTaskId(null);
  }, []);

  const handleObjectSelect = useCallback((objectId: string | null) => {
    setSelectedObjectId(objectId);
  }, []);

  const handleApplyOp = useCallback((op: Operation) => {
    undoRedo.pushSnapshot(artifact);
    const next = service.applyOp(artifact, op);
    onArtifactChange(next);
  }, [artifact, service, onArtifactChange, undoRedo]);

  const handleUndo = useCallback(() => {
    const prev = undoRedo.undo(artifact);
    if (prev) {
      onArtifactChange(prev);
    }
  }, [artifact, undoRedo, onArtifactChange]);

  const handleRedo = useCallback(() => {
    const next = undoRedo.redo(artifact);
    if (next) {
      onArtifactChange(next);
    }
  }, [artifact, undoRedo, onArtifactChange]);

  const handleAddSlide = useCallback(() => {
    const slideId = uuidv4();
    const titleBoxId = uuidv4();

    undoRedo.pushSnapshot(artifact);

    const insertSlideOp: Operation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: slideId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: slideId,
          type: 'slide',
          childIds: [titleBoxId],
        },
        parentId: artifact.rootNodeId,
      },
    };

    const insertTitleOp: Operation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: titleBoxId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: titleBoxId,
          type: 'textbox',
          x: 60,
          y: 40,
          width: 840,
          height: 80,
          content: [{ text: 'New Slide', bold: true, fontSize: 36 }],
        } as Record<string, unknown> & { id: string; type: string },
        parentId: slideId,
      },
    };

    let next = service.applyOp(artifact, insertSlideOp);
    next = service.applyOp(next, insertTitleOp);
    onArtifactChange(next);
    setSelectedSlideId(slideId);
    setSelectedObjectId(null);
  }, [artifact, service, onArtifactChange, undoRedo]);

  const handleDeleteObject = useCallback(() => {
    if (!selectedObjectId) return;
    undoRedo.pushSnapshot(artifact);
    const deleteOp: Operation = {
      operationId: uuidv4(),
      type: 'delete_node',
      artifactId: artifact.artifactId,
      targetId: selectedObjectId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
    };
    const next = service.applyOp(artifact, deleteOp);
    onArtifactChange(next);
    setSelectedObjectId(null);
  }, [selectedObjectId, artifact, service, onArtifactChange, undoRedo]);

  const handleDuplicateObject = useCallback(() => {
    if (!selectedObjectId || !effectiveSlideId) return;
    const node = artifact.nodes[selectedObjectId] as unknown as Record<string, unknown> | undefined;
    if (!node) return;

    undoRedo.pushSnapshot(artifact);

    const newId = uuidv4();
    const newNode: Record<string, unknown> & { id: string; type: string } = {
      ...node,
      id: newId,
      x: ((node.x as number) ?? 0) + 20,
      y: ((node.y as number) ?? 0) + 20,
    } as Record<string, unknown> & { id: string; type: string };

    // Remove parentId/childIds to avoid stale references
    delete newNode.parentId;
    if (node.type !== 'slide') {
      delete newNode.childIds;
    }

    const insertOp: Operation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: newId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        node: newNode,
        parentId: effectiveSlideId,
      },
    };

    const next = service.applyOp(artifact, insertOp);
    onArtifactChange(next);
    setSelectedObjectId(newId);
  }, [selectedObjectId, effectiveSlideId, artifact, service, onArtifactChange, undoRedo]);

  // Insert handlers
  const handleInsertTextBox = useCallback(() => {
    if (!effectiveSlideId) return;
    undoRedo.pushSnapshot(artifact);

    const newId = uuidv4();
    const insertOp: Operation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: newId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: newId,
          type: 'textbox',
          x: 280,
          y: 200,
          width: 400,
          height: 100,
          content: [{ text: 'Text', fontSize: 16 }],
        } as Record<string, unknown> & { id: string; type: string },
        parentId: effectiveSlideId,
      },
    };

    const next = service.applyOp(artifact, insertOp);
    onArtifactChange(next);
    setSelectedObjectId(newId);
  }, [effectiveSlideId, artifact, service, onArtifactChange, undoRedo]);

  const handleInsertRectangle = useCallback(() => {
    if (!effectiveSlideId) return;
    undoRedo.pushSnapshot(artifact);

    const newId = uuidv4();
    const insertOp: Operation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: newId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: newId,
          type: 'shape',
          shapeType: 'rectangle',
          x: 380,
          y: 220,
          width: 200,
          height: 100,
          fill: '#e0e0e0',
        } as Record<string, unknown> & { id: string; type: string },
        parentId: effectiveSlideId,
      },
    };

    const next = service.applyOp(artifact, insertOp);
    onArtifactChange(next);
    setSelectedObjectId(newId);
  }, [effectiveSlideId, artifact, service, onArtifactChange, undoRedo]);

  const handleInsertEllipse = useCallback(() => {
    if (!effectiveSlideId) return;
    undoRedo.pushSnapshot(artifact);

    const newId = uuidv4();
    const insertOp: Operation = {
      operationId: uuidv4(),
      type: 'insert_node',
      artifactId: artifact.artifactId,
      targetId: newId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        node: {
          id: newId,
          type: 'shape',
          shapeType: 'ellipse',
          x: 380,
          y: 220,
          width: 200,
          height: 150,
          fill: '#bbdefb',
        } as Record<string, unknown> & { id: string; type: string },
        parentId: effectiveSlideId,
      },
    };

    const next = service.applyOp(artifact, insertOp);
    onArtifactChange(next);
    setSelectedObjectId(newId);
  }, [effectiveSlideId, artifact, service, onArtifactChange, undoRedo]);

  // Global keyboard handler for undo/redo/save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+Z - undo
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd+Shift+Z - redo
      if (isMeta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl/Cmd+S - save
      if (isMeta && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, onSave]);

  // AI handlers
  const handleAiTask = useCallback(async (taskType: string, parameters: Record<string, unknown>) => {
    if (!effectiveSlideId) return;
    setIsAiLoading(true);
    setAiPreviewText(null);

    try {
      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType,
          targetId: effectiveSlideId,
          parameters,
          artifact,
        }),
      });

      const data = await response.json();
      setAiPreviewText(data.previewText ?? 'No preview available');
      setPendingTaskId(data.taskId);
    } catch (err) {
      setAiPreviewText(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setIsAiLoading(false);
    }
  }, [effectiveSlideId, artifact]);

  const handleApprove = useCallback(async () => {
    if (!pendingTaskId) return;
    try {
      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/${pendingTaskId}/approve`, {
        method: 'POST',
      });
      const data = await response.json();
      undoRedo.pushSnapshot(artifact);
      let next = artifact;
      for (const op of data.approvedOperations ?? []) {
        next = service.applyOp(next, op);
      }
      onArtifactChange(next);
      setAiPreviewText(null);
      setPendingTaskId(null);
    } catch (err) {
      setAiPreviewText(`Approve error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [pendingTaskId, artifact, service, onArtifactChange, undoRedo]);

  const handleReject = useCallback(async () => {
    if (!pendingTaskId) return;
    try {
      await fetch(`${AI_RUNTIME_URL}/ai/tasks/${pendingTaskId}/reject`, {
        method: 'POST',
      });
    } catch {
      // Ignore reject errors
    }
    setAiPreviewText(null);
    setPendingTaskId(null);
  }, [pendingTaskId]);

  const activeSlide = effectiveSlideId ? slideIndex.slideById[effectiveSlideId] : undefined;
  const activeObjectIds = effectiveSlideId ? (slideIndex.objectIdsBySlideId[effectiveSlideId] ?? []) : [];
  const activeNotes = effectiveSlideId ? slideIndex.notesBySlideId[effectiveSlideId] : undefined;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      {/* Left: Thumbnail pane */}
      <SlideThumbnailPane
        slideIds={slideIds}
        nodes={artifact.nodes}
        slideIndex={slideIndex}
        selectedSlideId={effectiveSlideId}
        onSlideSelect={handleSlideSelect}
        onAddSlide={handleAddSlide}
      />

      {/* Center: Canvas + toolbar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Undo/Redo bar */}
        <div style={{
          padding: '4px 16px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#f8f8f8',
          fontSize: 12,
        }}>
          <button
            onClick={handleUndo}
            disabled={!undoRedo.canUndo}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              cursor: undoRedo.canUndo ? 'pointer' : 'default',
              opacity: undoRedo.canUndo ? 1 : 0.4,
            }}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!undoRedo.canRedo}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              cursor: undoRedo.canRedo ? 'pointer' : 'default',
              opacity: undoRedo.canRedo ? 1 : 0.4,
            }}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
        </div>

        {/* Object toolbar - always show when a slide is selected */}
        {effectiveSlideId && (
          <ObjectToolbar
            selectedObjectId={selectedObjectId}
            node={selectedObjectId ? artifact.nodes[selectedObjectId] : undefined}
            onDelete={handleDeleteObject}
            onDuplicate={handleDuplicateObject}
            onInsertTextBox={handleInsertTextBox}
            onInsertRectangle={handleInsertRectangle}
            onInsertEllipse={handleInsertEllipse}
          />
        )}
        <SlideCanvas
          slide={activeSlide}
          objectIds={activeObjectIds}
          nodes={artifact.nodes}
          selectedObjectId={selectedObjectId}
          onObjectSelect={handleObjectSelect}
          onApplyOp={handleApplyOp}
          artifactId={artifact.artifactId}
          onDeleteObject={handleDeleteObject}
          onDuplicateObject={handleDuplicateObject}
        />
        {activeNotes && (
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid #ddd',
            background: '#fffbe6',
            fontSize: 12,
            color: '#666',
          }}>
            <strong>Speaker Notes: </strong>
            {activeNotes.content.map((r) => r.text).join('')}
          </div>
        )}
      </div>

      {/* Right: AI panel */}
      <DeckAiPanel
        selectedSlideId={effectiveSlideId}
        isLoading={isAiLoading}
        previewText={aiPreviewText}
        onAiTask={handleAiTask}
        onApprove={handleApprove}
        onReject={handleReject}
        pendingTaskId={pendingTaskId}
      />
    </div>
  );
};
