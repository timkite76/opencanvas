import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode, CellNode, WorksheetNode } from '@opencanvas/grid-model';
import { columnIndexToLabel, parseCellAddress } from '@opencanvas/grid-model';
import { FormulaBar } from './FormulaBar.js';
import { WorksheetTabs } from './WorksheetTabs.js';
import { VirtualGrid, normalizeRange } from './VirtualGrid.js';
import type { SelectionRange } from './VirtualGrid.js';
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

/** Get all addresses in a selection range */
function getAddressesInRange(range: SelectionRange): string[] {
  const { minCol, maxCol, minRow, maxRow } = normalizeRange(range);
  const addresses: string[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      addresses.push(`${columnIndexToLabel(col)}${row}`);
    }
  }
  return addresses;
}

/** Check if a selection range covers more than one cell */
function isMultiCellRange(range: SelectionRange): boolean {
  return range.startCol !== range.endCol || range.startRow !== range.endRow;
}

/** Compute stats for numeric cells in the range */
function computeRangeStats(
  range: SelectionRange,
  cellMap: Map<string, CellNode>,
): { count: number; sum: number; average: number } | null {
  const addresses = getAddressesInRange(range);
  const numbers: number[] = [];

  for (const addr of addresses) {
    const cell = cellMap.get(addr.toUpperCase());
    if (cell && cell.valueType === 'number' && cell.rawValue !== null) {
      const num = Number(cell.rawValue);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
  }

  if (numbers.length < 2) return null;

  const sum = numbers.reduce((a, b) => a + b, 0);
  return {
    count: numbers.length,
    sum,
    average: sum / numbers.length,
  };
}

/** Format a number for status bar display */
function formatStat(val: number): string {
  // Use toPrecision to avoid floating point artifacts, then clean up
  const cleaned = parseFloat(val.toPrecision(10));
  if (Number.isInteger(cleaned)) {
    return cleaned.toLocaleString('en-US');
  }
  return cleaned.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

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
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);

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

  // Compute status bar stats
  const rangeStats = useMemo(() => {
    if (!selectionRange || !isMultiCellRange(selectionRange)) return null;
    return computeRangeStats(selectionRange, cellMap);
  }, [selectionRange, cellMap]);

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

  /** Apply a value change to a cell by address, returning the updated artifact */
  const applyCellValueByAddress = useCallback(
    (art: ArtifactEnvelope<GridNode>, address: string, value: string | number | boolean | null): ArtifactEnvelope<GridNode> => {
      const cell = (() => {
        for (const node of Object.values(art.nodes)) {
          if (node.type === 'cell' && (node as CellNode).address.toUpperCase() === address.toUpperCase()) {
            return node as CellNode;
          }
        }
        return undefined;
      })();
      if (!cell) return art;
      return service.applyCellValueChange(art, cell.id, value);
    },
    [service],
  );

  const handleDeleteCell = useCallback(() => {
    // If we have a multi-cell range, delete all cells in range
    if (selectionRange && isMultiCellRange(selectionRange)) {
      const addresses = getAddressesInRange(selectionRange);
      let next = artifact;
      for (const addr of addresses) {
        next = applyCellValueByAddress(next, addr, null);
      }
      onArtifactChange(next);
      return;
    }

    // Single cell delete
    if (!selectedCellId || !selectedAddress) return;
    const next = service.applyCellValueChange(artifact, selectedCellId, null);
    onArtifactChange(next);
  }, [artifact, selectedCellId, selectedAddress, service, onArtifactChange, selectionRange, applyCellValueByAddress]);

  const handleCopyCell = useCallback(() => {
    // If we have a multi-cell range, copy as TSV
    if (selectionRange && isMultiCellRange(selectionRange)) {
      const { minCol, maxCol, minRow, maxRow } = normalizeRange(selectionRange);
      const rowStrings: string[] = [];
      for (let row = minRow; row <= maxRow; row++) {
        const colValues: string[] = [];
        for (let col = minCol; col <= maxCol; col++) {
          const addr = `${columnIndexToLabel(col)}${row}`;
          const cell = cellMap.get(addr.toUpperCase());
          const value = cell?.formula ?? (cell?.rawValue === null ? '' : String(cell?.rawValue ?? ''));
          colValues.push(value);
        }
        rowStrings.push(colValues.join('\t'));
      }
      const tsv = rowStrings.join('\n');
      navigator.clipboard.writeText(tsv).catch(() => {
        // Clipboard write failed silently
      });
      return;
    }

    // Single cell copy
    if (!selectedAddress) return;
    const cell = cellMap.get(selectedAddress.toUpperCase());
    const value = cell?.formula ?? (cell?.rawValue === null ? '' : String(cell?.rawValue ?? ''));
    navigator.clipboard.writeText(value).catch(() => {
      // Clipboard write failed silently
    });
  }, [selectedAddress, cellMap, selectionRange]);

  const handlePasteCell = useCallback(() => {
    navigator.clipboard
      .readText()
      .then((text) => {
        if (!text || !selectedAddress) return;

        // Check if it's TSV data (has tabs or multiple lines)
        const lines = text.split('\n');
        const hasTabs = text.includes('\t');
        const isMultiCell = lines.length > 1 || hasTabs;

        if (isMultiCell) {
          // Parse the selected address to get the starting position
          let startPos: { col: number; row: number };
          try {
            const parsed = parseCellAddress(selectedAddress);
            startPos = { col: parsed.columnIndex, row: parsed.row };
          } catch {
            return;
          }

          let next = artifact;
          for (let rowOffset = 0; rowOffset < lines.length; rowOffset++) {
            const line = lines[rowOffset];
            if (line === undefined) continue;
            const cols = line.split('\t');
            for (let colOffset = 0; colOffset < cols.length; colOffset++) {
              const cellValue = cols[colOffset] ?? '';
              const targetCol = startPos.col + colOffset;
              const targetRow = startPos.row + rowOffset;

              if (activeWorksheet && targetCol < activeWorksheet.columnCount && targetRow <= activeWorksheet.rowCount) {
                const targetAddr = `${columnIndexToLabel(targetCol)}${targetRow}`;
                if (cellValue.startsWith('=')) {
                  // Apply as formula
                  const targetCell = (() => {
                    for (const node of Object.values(next.nodes)) {
                      if (node.type === 'cell' && (node as CellNode).address.toUpperCase() === targetAddr.toUpperCase()) {
                        return node as CellNode;
                      }
                    }
                    return undefined;
                  })();
                  if (targetCell) {
                    next = service.applyFormulaChange(next, targetCell.id, cellValue);
                  }
                } else {
                  // Parse as number if possible
                  const numVal = Number(cellValue);
                  const rawValue = cellValue === '' ? null : !isNaN(numVal) && cellValue.trim() !== '' ? numVal : cellValue;
                  next = applyCellValueByAddress(next, targetAddr, rawValue);
                }
              }
            }
          }
          onArtifactChange(next);
        } else {
          // Single value paste
          handleFormulaSubmit(text);
        }
      })
      .catch(() => {
        // Clipboard read failed silently
      });
  }, [selectedAddress, artifact, activeWorksheet, service, onArtifactChange, handleFormulaSubmit, applyCellValueByAddress]);

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
          selectionRange={selectionRange}
          onSelectionRangeChange={setSelectionRange}
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
      {/* Status bar - shows above worksheet tabs when range has numeric stats */}
      {rangeStats && (
        <div
          style={{
            height: 24,
            background: '#f8f9fa',
            borderTop: '1px solid #e2e2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 16px',
            gap: 20,
            fontSize: 11,
            color: '#5f6368',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <span>
            <span style={{ fontWeight: 500, color: '#3c4043' }}>Count: </span>
            {rangeStats.count}
          </span>
          <span>
            <span style={{ fontWeight: 500, color: '#3c4043' }}>Sum: </span>
            {formatStat(rangeStats.sum)}
          </span>
          <span>
            <span style={{ fontWeight: 500, color: '#3c4043' }}>Average: </span>
            {formatStat(rangeStats.average)}
          </span>
        </div>
      )}
      <WorksheetTabs
        worksheets={worksheets}
        activeWorksheetId={effectiveWorksheetId}
        onSelectWorksheet={setActiveWorksheetId}
      />
    </div>
  );
};
