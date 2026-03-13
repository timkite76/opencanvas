import { useState, useCallback, useRef } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode } from '@opencanvas/grid-model';

const MAX_UNDO_STACK = 50;

interface UndoRedoState {
  current: ArtifactEnvelope<GridNode>;
  canUndo: boolean;
  canRedo: boolean;
  pushSnapshot: (artifact: ArtifactEnvelope<GridNode>) => void;
  undo: () => ArtifactEnvelope<GridNode> | null;
  redo: () => ArtifactEnvelope<GridNode> | null;
  reset: (artifact: ArtifactEnvelope<GridNode>) => void;
}

export function useUndoRedo(initial: ArtifactEnvelope<GridNode> | null): UndoRedoState | null {
  const undoStackRef = useRef<ArtifactEnvelope<GridNode>[]>([]);
  const redoStackRef = useRef<ArtifactEnvelope<GridNode>[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactEnvelope<GridNode> | null>(initial);

  const pushSnapshot = useCallback((artifact: ArtifactEnvelope<GridNode>) => {
    if (currentArtifact) {
      undoStackRef.current = [
        ...undoStackRef.current.slice(-(MAX_UNDO_STACK - 1)),
        currentArtifact,
      ];
    }
    redoStackRef.current = [];
    setCurrentArtifact(artifact);
  }, [currentArtifact]);

  const undo = useCallback((): ArtifactEnvelope<GridNode> | null => {
    if (undoStackRef.current.length === 0 || !currentArtifact) return null;
    const prev = undoStackRef.current[undoStackRef.current.length - 1]!;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, currentArtifact];
    setCurrentArtifact(prev);
    return prev;
  }, [currentArtifact]);

  const redo = useCallback((): ArtifactEnvelope<GridNode> | null => {
    if (redoStackRef.current.length === 0 || !currentArtifact) return null;
    const next = redoStackRef.current[redoStackRef.current.length - 1]!;
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, currentArtifact];
    setCurrentArtifact(next);
    return next;
  }, [currentArtifact]);

  const reset = useCallback((artifact: ArtifactEnvelope<GridNode>) => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCurrentArtifact(artifact);
  }, []);

  if (!currentArtifact) return null;

  return {
    current: currentArtifact,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    pushSnapshot,
    undo,
    redo,
    reset,
  };
}
