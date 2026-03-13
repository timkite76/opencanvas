import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode, CellNode, WorksheetNode } from '@opencanvas/grid-model';
import { FormulaBar } from './FormulaBar.js';
import { WorksheetTabs } from './WorksheetTabs.js';
import { VirtualGrid } from './VirtualGrid.js';
import { GridAiPanel } from './GridAiPanel.js';
import type { WorkbookService } from '../services/workbook-service.js';

interface GridShellProps {
  artifact: ArtifactEnvelope<GridNode>;
  service: WorkbookService;
  onArtifactChange: (artifact: ArtifactEnvelope<GridNode>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
}

const AI_RUNTIME_URL = 'http://localhost:4001';

export const GridShell: React.FC<GridShellProps> = ({
  artifact,
  service,
  onArtifactChange,
  onUndo,
  onRedo,
  onSave,
}) => {
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [activeWorksheetId, setActiveWorksheetId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPreviewText, setAiPreviewText] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  // Derive worksheets
  const worksheets = useMemo(() => {
    return Object.values(artifact.nodes).filter(
      (n): n is WorksheetNode => n.type === 'worksheet',
    );
  }, [artifact.nodes]);

  // Auto-select first worksheet
  const effectiveWorksheetId = activeWorksheetId ?? worksheets[0]?.id ?? null;

  // Derive cells for the active worksheet
  const cellMap = useMemo(() => {
    const map = new Map<string, CellNode>();
    if (!effectiveWorksheetId) return map;
    for (const node of Object.values(artifact.nodes)) {
      if (node.type === 'cell' && node.parentId === effectiveWorksheetId) {
        const cell = node as CellNode;
        map.set(cell.address.toUpperCase(), cell);
      }
    }
    return map;
  }, [artifact.nodes, effectiveWorksheetId]);

  const activeWorksheet = effectiveWorksheetId
    ? (artifact.nodes[effectiveWorksheetId] as WorksheetNode | undefined)
    : undefined;

  const selectedCell = selectedCellId
    ? (artifact.nodes[selectedCellId] as CellNode | undefined)
    : undefined;

  const handleCellSelect = useCallback((cellId: string | null, address: string) => {
    setSelectedCellId(cellId);
    setSelectedAddress(address);
    setAiPreviewText(null);
    setPendingTaskId(null);
  }, []);

  const handleCellDoubleClick = useCallback((_address: string) => {
    // Double-click activates inline editing in VirtualGrid
  }, []);

  const handleFormulaSubmit = useCallback(
    (value: string) => {
      if (!selectedAddress) return;

      // Resolve cell ID - either existing or we need one
      let cellId = selectedCellId;
      if (!cellId) {
        // Find the cell by address in the cellMap
        const cell = cellMap.get(selectedAddress.toUpperCase());
        cellId = cell?.id ?? null;
      }
      if (!cellId) return;

      let next: ArtifactEnvelope<GridNode>;
      if (value.startsWith('=')) {
        next = service.applyFormulaChange(artifact, cellId, value);
      } else {
        // Parse as number if possible
        const numVal = Number(value);
        const rawValue = value === '' ? null : !isNaN(numVal) && value.trim() !== '' ? numVal : value;
        next = service.applyCellValueChange(artifact, cellId, rawValue);
      }
      onArtifactChange(next);
    },
    [artifact, selectedCellId, selectedAddress, cellMap, service, onArtifactChange],
  );

  const handleDeleteCell = useCallback(() => {
    if (!selectedCellId || !selectedAddress) return;
    const next = service.applyCellValueChange(artifact, selectedCellId, null);
    onArtifactChange(next);
  }, [artifact, selectedCellId, selectedAddress, service, onArtifactChange]);

  const handleCopyCell = useCallback(() => {
    if (!selectedAddress) return;
    const cell = cellMap.get(selectedAddress.toUpperCase());
    const value = cell?.formula ?? (cell?.rawValue === null ? '' : String(cell?.rawValue ?? ''));
    navigator.clipboard.writeText(value).catch(() => {
      // Clipboard write failed silently
    });
  }, [selectedAddress, cellMap]);

  const handlePasteCell = useCallback(() => {
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text && selectedAddress) {
          handleFormulaSubmit(text);
        }
      })
      .catch(() => {
        // Clipboard read failed silently
      });
  }, [selectedAddress, handleFormulaSubmit]);

  // Global keyboard shortcuts for undo/redo/save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }

      if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Ctrl+Y also redo
      if (isMod && e.key === 'y') {
        e.preventDefault();
        onRedo?.();
        return;
      }

      if (isMod && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onUndo, onRedo, onSave]);

  const handleGenerateFormula = useCallback(
    async (description: string) => {
      if (!selectedCellId) return;
      setIsAiLoading(true);
      setAiPreviewText(null);

      try {
        const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskType: 'generate_formula',
            targetId: selectedCellId,
            parameters: { description, targetCellId: selectedCellId },
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
    },
    [selectedCellId, artifact],
  );

  const handleExplainFormula = useCallback(async () => {
    if (!selectedCellId) return;
    setIsAiLoading(true);
    setAiPreviewText(null);

    try {
      const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'explain_formula',
          targetId: selectedCellId,
          parameters: { cellId: selectedCellId },
          artifact,
        }),
      });

      const data = await response.json();
      setAiPreviewText(data.previewText ?? 'No explanation available');
      setPendingTaskId(null); // explain doesn't produce operations
    } catch (err) {
      setAiPreviewText(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setIsAiLoading(false);
    }
  }, [selectedCellId, artifact]);

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

  if (!activeWorksheet) {
    return <div style={{ padding: 16, color: '#888' }}>No worksheets found in this workbook.</div>;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FormulaBar
        cellAddress={selectedAddress}
        cellFormula={selectedCell?.formula ?? null}
        cellRawValue={selectedCell?.rawValue ?? null}
        onFormulaSubmit={handleFormulaSubmit}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <VirtualGrid
          worksheet={activeWorksheet}
          cells={cellMap}
          selectedCellId={selectedCellId}
          selectedAddress={selectedAddress}
          onCellSelect={handleCellSelect}
          onCellDoubleClick={handleCellDoubleClick}
          onFormulaSubmit={handleFormulaSubmit}
          onDeleteCell={handleDeleteCell}
          onCopyCell={handleCopyCell}
          onPasteCell={handlePasteCell}
        />
        <GridAiPanel
          selectedCellId={selectedCellId}
          selectedCellAddress={selectedAddress}
          onGenerateFormula={handleGenerateFormula}
          onExplainFormula={handleExplainFormula}
          isLoading={isAiLoading}
          previewText={aiPreviewText}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
      <WorksheetTabs
        worksheets={worksheets}
        activeWorksheetId={effectiveWorksheetId}
        onSelectWorksheet={setActiveWorksheetId}
      />
    </div>
  );
};
