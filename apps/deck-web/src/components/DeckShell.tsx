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
import { PresentationMode } from './PresentationMode.js';

interface DeckShellProps {
  artifact: ArtifactEnvelope<DeckNode>;
  service: PresentationService;
  onArtifactChange: (artifact: ArtifactEnvelope<DeckNode>) => void;
  onSave?: () => void;
  isPresenting?: boolean;
  presentFromFirst?: boolean;
  onStartPresenting?: (fromFirst: boolean) => void;
  onStopPresenting?: () => void;
}

const AI_RUNTIME_URL = 'http://localhost:4001';

const undoRedoBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'system-ui, sans-serif',
  border: '1px solid #dadce0',
  borderRadius: 4,
  background: '#ffffff',
  color: '#3c4043',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  transition: 'background 0.15s ease',
};

const undoRedoBtnDisabled: React.CSSProperties = {
  ...undoRedoBtnStyle,
  opacity: 0.35,
  cursor: 'not-allowed',
  pointerEvents: 'none' as const,
};

export const DeckShell: React.FC<DeckShellProps> = ({
  artifact,
  service,
  onArtifactChange,
  onSave,
  isPresenting,
  presentFromFirst,
  onStartPresenting,
  onStopPresenting,
}) => {
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPreviewText, setAiPreviewText] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [notesEditing, setNotesEditing] = useState(false);
  const [lastTaskOutput, setLastTaskOutput] = useState<Record<string, unknown> | null>(null);

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
    setNotesEditing(false);
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

  const handleReorderSlide = useCallback((slideId: string, newIndex: number) => {
    undoRedo.pushSnapshot(artifact);
    const op: Operation = {
      operationId: uuidv4(),
      type: 'move_node',
      artifactId: artifact.artifactId,
      targetId: slideId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        newParentId: artifact.rootNodeId,
        index: newIndex,
      },
    };
    const next = service.applyOp(artifact, op);
    onArtifactChange(next);
  }, [artifact, service, onArtifactChange, undoRedo]);

  const handleUpdateNodePatch = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    undoRedo.pushSnapshot(artifact);
    const op: Operation = {
      operationId: uuidv4(),
      type: 'update_node',
      artifactId: artifact.artifactId,
      targetId: nodeId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        patch,
      },
    };
    const next = service.applyOp(artifact, op);
    onArtifactChange(next);
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

      // F5 - present from first slide
      if (e.key === 'F5' && !e.shiftKey) {
        e.preventDefault();
        onStartPresenting?.(true);
        return;
      }

      // Shift+F5 - present from current slide
      if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault();
        onStartPresenting?.(false);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, onSave, onStartPresenting]);

  // AI handlers
  const handleAiTask = useCallback(async (taskType: string, parameters: Record<string, unknown>) => {
    const targetId = effectiveSlideId ?? artifact.rootNodeId;
    setIsAiLoading(true);
    setAiPreviewText(null);
    setLastTaskOutput(null);

    try {
      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType,
          targetId,
          parameters,
          artifact,
        }),
      });

      const data = await response.json();
      setAiPreviewText(data.previewText ?? 'No preview available');
      setPendingTaskId(data.taskId);
      setLastTaskOutput(data.output ?? null);
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

  // AI rewrite handler for individual text box from toolbar
  const handleAiRewrite = useCallback((tone: string) => {
    if (!effectiveSlideId) return;
    handleAiTask('rewrite_slide', { slideId: effectiveSlideId, tone });
  }, [effectiveSlideId, handleAiTask]);

  // Navigate to a specific slide (used by coach feedback)
  const handleNavigateToSlide = useCallback((slideId: string) => {
    setSelectedSlideId(slideId);
    setSelectedObjectId(null);
  }, []);

  // Speaker notes edit handler
  const handleNotesBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    setNotesEditing(false);
    if (!effectiveSlideId || !activeNotes) return;

    const newText = e.currentTarget.textContent ?? '';
    const originalText = activeNotes.content.map((r) => r.text).join('');

    if (newText === originalText) return;

    // Find the notes node ID
    const slideNode = artifact.nodes[effectiveSlideId];
    if (!slideNode?.childIds) return;

    let notesNodeId: string | null = null;
    for (const cid of slideNode.childIds) {
      const child = artifact.nodes[cid] as unknown as Record<string, unknown> | undefined;
      if (child?.type === 'speaker_notes') {
        notesNodeId = cid;
        break;
      }
    }

    if (!notesNodeId) return;

    undoRedo.pushSnapshot(artifact);
    const op: Operation = {
      operationId: uuidv4(),
      type: 'replace_text',
      artifactId: artifact.artifactId,
      targetId: notesNodeId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        startOffset: 0,
        endOffset: originalText.length,
        newText,
        oldText: originalText,
      },
    };
    const next = service.applyOp(artifact, op);
    onArtifactChange(next);
  }, [effectiveSlideId, artifact, service, onArtifactChange, undoRedo]);

  const activeSlide = effectiveSlideId ? slideIndex.slideById[effectiveSlideId] : undefined;
  const activeObjectIds = effectiveSlideId ? (slideIndex.objectIdsBySlideId[effectiveSlideId] ?? []) : [];
  const activeNotes = effectiveSlideId ? slideIndex.notesBySlideId[effectiveSlideId] : undefined;
  const notesText = activeNotes?.content.map((r) => r.text).join('') ?? '';

  // Compute current slide index for presentation mode
  const currentSlideIndex = effectiveSlideId ? slideIds.indexOf(effectiveSlideId) : 0;

  if (isPresenting) {
    const startIndex = presentFromFirst ? 0 : Math.max(0, currentSlideIndex);
    return (
      <PresentationMode
        slideIds={slideIds}
        nodes={artifact.nodes}
        slideIndex={slideIndex}
        startSlideIndex={startIndex}
        onExit={() => onStopPresenting?.()}
      />
    );
  }

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
        onReorderSlide={handleReorderSlide}
      />

      {/* Center: Canvas + toolbar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Undo/Redo bar */}
        <div style={{
          padding: '4px 16px',
          borderBottom: '1px solid #e8eaed',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#ffffff',
          fontSize: 12,
        }}>
          <button
            onClick={handleUndo}
            disabled={!undoRedo.canUndo}
            style={undoRedo.canUndo ? undoRedoBtnStyle : undoRedoBtnDisabled}
            title="Undo (Ctrl+Z)"
            onMouseEnter={(e) => { if (undoRedo.canUndo) e.currentTarget.style.background = '#f1f3f4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
          >
            <span style={{ fontSize: 14 }}>&#x21A9;</span> Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!undoRedo.canRedo}
            style={undoRedo.canRedo ? undoRedoBtnStyle : undoRedoBtnDisabled}
            title="Redo (Ctrl+Shift+Z)"
            onMouseEnter={(e) => { if (undoRedo.canRedo) e.currentTarget.style.background = '#f1f3f4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
          >
            <span style={{ fontSize: 14 }}>&#x21AA;</span> Redo
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
            onUpdateNodePatch={handleUpdateNodePatch}
            onAiRewrite={handleAiRewrite}
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

        {/* Speaker Notes - collapsible/expandable/editable */}
        <div style={{
          borderTop: '1px solid #dadce0',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Notes header - always visible, acts as toggle */}
          <div
            onClick={() => setNotesExpanded((v) => !v)}
            style={{
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none',
              background: '#fafafa',
              borderBottom: notesExpanded ? '1px solid #e8eaed' : 'none',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f3f4'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
          >
            <span style={{
              fontSize: 10,
              color: '#5f6368',
              transition: 'transform 0.2s ease',
              transform: notesExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>
              &#x25B6;
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#3c4043',
            }}>
              Speaker Notes
            </span>
            {!notesExpanded && notesText && (
              <span style={{
                fontSize: 11,
                color: '#80868b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                maxWidth: 400,
              }}>
                {notesText}
              </span>
            )}
            {notesExpanded && activeNotes && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNotesEditing(true);
                }}
                style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  border: '1px solid #dadce0',
                  borderRadius: 4,
                  background: notesEditing ? '#e8f0fe' : '#ffffff',
                  color: notesEditing ? '#1a73e8' : '#5f6368',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                  transition: 'background 0.15s ease',
                }}
              >
                {notesEditing ? 'Editing' : 'Edit'}
              </button>
            )}
          </div>

          {/* Notes content */}
          {notesExpanded && (
            <div
              style={{
                padding: '10px 16px',
                fontSize: 13,
                lineHeight: 1.6,
                color: '#3c4043',
                minHeight: 48,
                maxHeight: 120,
                overflowY: 'auto',
                outline: 'none',
                background: notesEditing ? '#fffef7' : '#ffffff',
                borderLeft: notesEditing ? '3px solid #fbbc04' : '3px solid transparent',
                transition: 'background 0.15s ease, border-color 0.15s ease',
                caretColor: '#1a73e8',
              }}
              contentEditable={notesEditing}
              suppressContentEditableWarning
              onBlur={handleNotesBlur}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setNotesEditing(false);
                  (e.target as HTMLElement).blur();
                }
              }}
            >
              {notesText || (
                <span style={{ color: '#9e9e9e', fontStyle: 'italic' }}>
                  {activeNotes ? 'No speaker notes' : 'No notes for this slide'}
                </span>
              )}
            </div>
          )}
        </div>
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
        onNavigateToSlide={handleNavigateToSlide}
        lastTaskOutput={lastTaskOutput}
      />
    </div>
  );
};
