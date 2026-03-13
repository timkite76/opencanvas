import React, { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode, SlideNode } from '@opencanvas/deck-model';
import { buildSlideIndex } from '@opencanvas/deck-model';
import type { PresentationService } from '../services/presentation-service.js';
import { SlideThumbnailPane } from './SlideThumbnailPane.js';
import { SlideCanvas } from './SlideCanvas.js';
import { ObjectToolbar } from './ObjectToolbar.js';
import { DeckAiPanel } from './DeckAiPanel.js';

interface DeckShellProps {
  artifact: ArtifactEnvelope<DeckNode>;
  service: PresentationService;
  onArtifactChange: (artifact: ArtifactEnvelope<DeckNode>) => void;
}

const AI_RUNTIME_URL = 'http://localhost:4001';

export const DeckShell: React.FC<DeckShellProps> = ({
  artifact,
  service,
  onArtifactChange,
}) => {
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPreviewText, setAiPreviewText] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

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
    const next = service.applyOp(artifact, op);
    onArtifactChange(next);
  }, [artifact, service, onArtifactChange]);

  const handleAddSlide = useCallback(() => {
    const slideId = uuidv4();
    const titleBoxId = uuidv4();

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
  }, [artifact, service, onArtifactChange]);

  const handleDeleteObject = useCallback(() => {
    if (!selectedObjectId) return;
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
  }, [selectedObjectId, artifact, service, onArtifactChange]);

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
  }, [pendingTaskId, artifact, service, onArtifactChange]);

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
        {selectedObjectId && (
          <ObjectToolbar
            objectId={selectedObjectId}
            node={artifact.nodes[selectedObjectId]}
            onDelete={handleDeleteObject}
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
