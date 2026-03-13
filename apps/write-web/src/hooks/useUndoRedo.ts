import { useCallback, useRef, useState } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';

const MAX_UNDO_STACK = 50;

/**
 * Deep-clones an ArtifactEnvelope by serializing to JSON.
 * This ensures undo snapshots are fully independent of the live artifact.
 */
function cloneArtifact(artifact: ArtifactEnvelope): ArtifactEnvelope {
  return JSON.parse(JSON.stringify(artifact));
}

export interface UndoRedoControls {
  /** Call before applying an operation to snapshot the current state. */
  pushSnapshot: (artifact: ArtifactEnvelope) => void;
  /** Undo: returns the previous artifact snapshot, or null if nothing to undo. */
  undo: () => ArtifactEnvelope | null;
  /** Redo: returns the next artifact snapshot, or null if nothing to redo. */
  redo: () => ArtifactEnvelope | null;
  /** Push a snapshot onto the redo stack (used by undo to enable redo). */
  pushToRedo: (artifact: ArtifactEnvelope) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo(): UndoRedoControls {
  const undoStackRef = useRef<ArtifactEnvelope[]>([]);
  const redoStackRef = useRef<ArtifactEnvelope[]>([]);
  // revision counter triggers re-renders when stacks change
  const [, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  const pushSnapshot = useCallback((artifact: ArtifactEnvelope) => {
    undoStackRef.current.push(cloneArtifact(artifact));
    if (undoStackRef.current.length > MAX_UNDO_STACK) {
      undoStackRef.current.shift();
    }
    // Clear redo stack on new user action
    redoStackRef.current = [];
    bump();
  }, [bump]);

  const undo = useCallback((): ArtifactEnvelope | null => {
    if (undoStackRef.current.length === 0) return null;
    const snapshot = undoStackRef.current.pop()!;
    bump();
    return snapshot;
  }, [bump]);

  const redo = useCallback((): ArtifactEnvelope | null => {
    if (redoStackRef.current.length === 0) return null;
    const snapshot = redoStackRef.current.pop()!;
    bump();
    return snapshot;
  }, [bump]);

  const pushToRedo = useCallback((artifact: ArtifactEnvelope) => {
    redoStackRef.current.push(cloneArtifact(artifact));
    bump();
  }, [bump]);

  return {
    pushSnapshot,
    undo,
    redo,
    pushToRedo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
  };
}
