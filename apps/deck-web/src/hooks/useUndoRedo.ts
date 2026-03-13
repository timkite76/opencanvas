import { useState, useCallback, useRef } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode } from '@opencanvas/deck-model';

const MAX_HISTORY = 50;

export interface UndoRedoControls {
  pushSnapshot: (artifact: ArtifactEnvelope<DeckNode>) => void;
  undo: () => ArtifactEnvelope<DeckNode> | null;
  redo: () => ArtifactEnvelope<DeckNode> | null;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo(): UndoRedoControls {
  const undoStack = useRef<ArtifactEnvelope<DeckNode>[]>([]);
  const redoStack = useRef<ArtifactEnvelope<DeckNode>[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const pushSnapshot = useCallback((artifact: ArtifactEnvelope<DeckNode>) => {
    undoStack.current.push(artifact);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    // Clear redo stack on new action
    redoStack.current = [];
    syncFlags();
  }, [syncFlags]);

  const undo = useCallback((): ArtifactEnvelope<DeckNode> | null => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return null;
    // The caller must push the *current* state onto redo before calling undo.
    // We return the previous state for the caller to apply.
    syncFlags();
    return snapshot;
  }, [syncFlags]);

  const redo = useCallback((): ArtifactEnvelope<DeckNode> | null => {
    const snapshot = redoStack.current.pop();
    if (!snapshot) return null;
    syncFlags();
    return snapshot;
  }, [syncFlags]);

  // Expose pushing to redo stack for the caller
  const undoRedoControls: UndoRedoControls = {
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  };

  // Override undo/redo to handle redo stack properly
  // The DeckShell will manage pushing current state to redo on undo
  return undoRedoControls;
}

/**
 * A simpler approach: the hook manages both stacks internally.
 * The caller provides the current artifact when undoing/redoing.
 */
export interface UndoRedoManager {
  /** Call before applying a new operation to save the current state */
  pushSnapshot: (artifact: ArtifactEnvelope<DeckNode>) => void;
  /** Undo: returns the previous state, or null if nothing to undo. Caller must pass current state to push onto redo stack. */
  undo: (currentArtifact: ArtifactEnvelope<DeckNode>) => ArtifactEnvelope<DeckNode> | null;
  /** Redo: returns the next state, or null if nothing to redo. Caller must pass current state to push onto undo stack. */
  redo: (currentArtifact: ArtifactEnvelope<DeckNode>) => ArtifactEnvelope<DeckNode> | null;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedoManager(): UndoRedoManager {
  const undoStack = useRef<ArtifactEnvelope<DeckNode>[]>([]);
  const redoStack = useRef<ArtifactEnvelope<DeckNode>[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const pushSnapshot = useCallback((artifact: ArtifactEnvelope<DeckNode>) => {
    undoStack.current.push(artifact);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    syncFlags();
  }, [syncFlags]);

  const undo = useCallback((currentArtifact: ArtifactEnvelope<DeckNode>): ArtifactEnvelope<DeckNode> | null => {
    const previous = undoStack.current.pop();
    if (!previous) return null;
    redoStack.current.push(currentArtifact);
    syncFlags();
    return previous;
  }, [syncFlags]);

  const redo = useCallback((currentArtifact: ArtifactEnvelope<DeckNode>): ArtifactEnvelope<DeckNode> | null => {
    const next = redoStack.current.pop();
    if (!next) return null;
    undoStack.current.push(currentArtifact);
    syncFlags();
    return next;
  }, [syncFlags]);

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
