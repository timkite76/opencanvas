import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import type { CellNode, WorksheetNode } from '@opencanvas/grid-model';
import { columnIndexToLabel, parseCellAddress } from '@opencanvas/grid-model';

export interface GridPosition {
  col: number; // 0-based column index
  row: number; // 1-based row number
}

export interface SelectionRange {
  startCol: number; // 0-based, anchor
  startRow: number; // 1-based, anchor
  endCol: number;   // 0-based, moving end
  endRow: number;   // 1-based, moving end
}

interface VirtualGridProps {
  worksheet: WorksheetNode;
  cells: Map<string, CellNode>;
  selectedCellId: string | null;
  selectedAddress: string | null;
  onCellSelect: (cellId: string | null, address: string) => void;
  onCellDoubleClick: (address: string) => void;
  onFormulaSubmit: (value: string) => void;
  onDeleteCell: () => void;
  onCopyCell: () => void;
  onPasteCell: () => void;
  selectionRange: SelectionRange | null;
  onSelectionRangeChange: (range: SelectionRange | null) => void;
  freezeRows?: number;
  freezeCols?: number;
  /** Called when user clicks the "Fix" button on an error cell */
  onFixError?: (cellId: string, formula: string, errorValue: string) => void;
}

const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 28;
const HEADER_WIDTH = 46;
const HEADER_HEIGHT = 24;
const RESIZE_HANDLE_SIZE = 4;

const COLORS = {
  headerBg: '#f8f9fa',
  headerBorderBottom: '#c0c0c0',
  headerText: '#5f6368',
  cellBorder: '#e2e2e2',
  rowEven: '#ffffff',
  rowOdd: '#f8f9fa',
  selectedBorder: '#1a73e8',
  selectedBg: '#e8f0fe',
  rangeBg: '#e8f0fe',
  editBg: '#ffffff',
  textPrimary: '#202124',
  textError: '#d93025',
  textBoolean: '#1967d2',
  cornerBg: '#f8f9fa',
  headerSelectedBg: '#d3e3fd',
  headerSelectedText: '#1a73e8',
  frozenBg: '#f0f4f8',
  freezeBorder: '#9aa0a6',
};

function addressFromPosition(pos: GridPosition): string {
  return `${columnIndexToLabel(pos.col)}${pos.row}`;
}

function positionFromAddress(address: string): GridPosition | null {
  try {
    const parsed = parseCellAddress(address);
    return { col: parsed.columnIndex, row: parsed.row };
  } catch {
    return null;
  }
}

/** Format a number for clean display: no floating-point artifacts, optional commas */
function formatDisplayNumber(val: string): string {
  const num = Number(val);
  if (isNaN(num)) return val;
  const cleaned = parseFloat(num.toPrecision(10));
  if (Number.isInteger(cleaned) && Math.abs(cleaned) >= 1000) {
    return cleaned.toLocaleString('en-US');
  }
  return String(cleaned);
}

function getCellTextAlign(valueType?: string): 'left' | 'right' | 'center' {
  if (valueType === 'number') return 'right';
  if (valueType === 'boolean') return 'center';
  return 'left';
}

function getCellColor(valueType?: string): string {
  if (valueType === 'error') return COLORS.textError;
  if (valueType === 'boolean') return COLORS.textBoolean;
  return COLORS.textPrimary;
}

function getDisplayValue(cell: CellNode | undefined): string {
  if (!cell) return '';
  const raw = cell.displayValue ?? '';
  if (cell.valueType === 'number' && raw !== '') {
    return formatDisplayNumber(raw);
  }
  if (cell.valueType === 'boolean') {
    return raw.toUpperCase();
  }
  return raw;
}

/** Get normalized min/max bounds from a selection range */
export function normalizeRange(range: SelectionRange): {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
} {
  return {
    minCol: Math.min(range.startCol, range.endCol),
    maxCol: Math.max(range.startCol, range.endCol),
    minRow: Math.min(range.startRow, range.endRow),
    maxRow: Math.max(range.startRow, range.endRow),
  };
}

/** Check if a cell position is within a selection range */
function isCellInRange(col: number, row: number, range: SelectionRange): boolean {
  const { minCol, maxCol, minRow, maxRow } = normalizeRange(range);
  return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
}

/** Check if a range is multi-cell (not a single cell) */
function isMultiCellRange(range: SelectionRange): boolean {
  return range.startCol !== range.endCol || range.startRow !== range.endRow;
}

/** Get column left offset given variable widths */
function getColLeft(colIdx: number, colWidths: Map<number, number>): number {
  let left = 0;
  for (let i = 0; i < colIdx; i++) {
    left += colWidths.get(i) ?? DEFAULT_COL_WIDTH;
  }
  return left;
}

/** Get row top offset given variable heights */
function getRowTop(rowNum: number, rowHeights: Map<number, number>): number {
  let top = 0;
  for (let i = 1; i < rowNum; i++) {
    top += rowHeights.get(i) ?? DEFAULT_ROW_HEIGHT;
  }
  return top;
}

export const VirtualGrid: React.FC<VirtualGridProps> = ({
  worksheet,
  cells,
  selectedCellId,
  selectedAddress,
  onCellSelect,
  onCellDoubleClick,
  onFormulaSubmit,
  onDeleteCell,
  onCopyCell,
  onPasteCell,
  selectionRange,
  onSelectionRangeChange,
  freezeRows = 0,
  freezeCols = 0,
  onFixError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Column widths and row heights (resize state)
  const [colWidths, setColWidths] = useState<Map<number, number>>(() => new Map());
  const [rowHeights, setRowHeights] = useState<Map<number, number>>(() => new Map());

  // Resize drag state
  const [resizingCol, setResizingCol] = useState<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const [resizingRow, setResizingRow] = useState<{ rowNum: number; startY: number; startHeight: number } | null>(null);

  const getColWidth = useCallback((colIdx: number) => colWidths.get(colIdx) ?? DEFAULT_COL_WIDTH, [colWidths]);
  const getRowHeight = useCallback((rowNum: number) => rowHeights.get(rowNum) ?? DEFAULT_ROW_HEIGHT, [rowHeights]);

  const totalCols = worksheet.columnCount;
  const totalRows = worksheet.rowCount;

  const columns = useMemo(() => {
    const cols: string[] = [];
    for (let i = 0; i < totalCols; i++) {
      cols.push(columnIndexToLabel(i));
    }
    return cols;
  }, [totalCols]);

  const rows = useMemo(() => {
    const r: number[] = [];
    for (let i = 1; i <= totalRows; i++) {
      r.push(i);
    }
    return r;
  }, [totalRows]);

  // Current selection as a position
  const selectedPosition = useMemo<GridPosition | null>(() => {
    if (!selectedAddress) return null;
    return positionFromAddress(selectedAddress);
  }, [selectedAddress]);

  const selectCell = useCallback(
    (pos: GridPosition) => {
      const addr = addressFromPosition(pos);
      const cell = cells.get(addr);
      onCellSelect(cell?.id ?? null, addr);
    },
    [cells, onCellSelect],
  );

  // Start inline editing
  const startEditing = useCallback(
    (address: string, initialValue?: string) => {
      const cell = cells.get(address);
      const val =
        initialValue !== undefined
          ? initialValue
          : cell?.formula ?? (cell?.rawValue === null ? '' : String(cell?.rawValue ?? ''));
      setEditingAddress(address);
      setEditValue(val);
    },
    [cells],
  );

  // Commit edit
  const commitEdit = useCallback(
    (moveDown = true) => {
      if (editingAddress === null) return;
      onFormulaSubmit(editValue);
      setEditingAddress(null);
      setEditValue('');

      if (moveDown && selectedPosition) {
        const nextRow = Math.min(selectedPosition.row + 1, totalRows);
        selectCell({ col: selectedPosition.col, row: nextRow });
      }
    },
    [editingAddress, editValue, onFormulaSubmit, selectedPosition, totalRows, selectCell],
  );

  // Cancel edit
  const cancelEdit = useCallback(() => {
    setEditingAddress(null);
    setEditValue('');
    containerRef.current?.focus();
  }, []);

  // Focus the edit input when editing starts
  useEffect(() => {
    if (editingAddress && editInputRef.current) {
      editInputRef.current.focus();
      const len = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [editingAddress]);

  // Scroll the selected cell into view
  useEffect(() => {
    if (!selectedPosition || !containerRef.current) return;
    const container = containerRef.current;
    const cellLeft = HEADER_WIDTH + getColLeft(selectedPosition.col, colWidths);
    const cellTop = HEADER_HEIGHT + getRowTop(selectedPosition.row, rowHeights);
    const w = getColWidth(selectedPosition.col);
    const h = getRowHeight(selectedPosition.row);
    const cellRight = cellLeft + w;
    const cellBottom = cellTop + h;

    const viewLeft = container.scrollLeft + HEADER_WIDTH;
    const viewTop = container.scrollTop + HEADER_HEIGHT;
    const viewRight = container.scrollLeft + container.clientWidth;
    const viewBottom = container.scrollTop + container.clientHeight;

    if (cellLeft < viewLeft) {
      container.scrollLeft = cellLeft - HEADER_WIDTH;
    } else if (cellRight > viewRight) {
      container.scrollLeft = cellRight - container.clientWidth;
    }

    if (cellTop < viewTop) {
      container.scrollTop = cellTop - HEADER_HEIGHT;
    } else if (cellBottom > viewBottom) {
      container.scrollTop = cellBottom - container.clientHeight;
    }
  }, [selectedPosition, colWidths, rowHeights, getColWidth, getRowHeight]);

  // Mouse drag support: track mouse move while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !selectionRange) return;
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      const x = e.clientX - rect.left + container.scrollLeft - HEADER_WIDTH;
      const y = e.clientY - rect.top + container.scrollTop - HEADER_HEIGHT;

      // Find column from x using variable widths
      let col = 0;
      let accX = 0;
      for (let c = 0; c < totalCols; c++) {
        const w = colWidths.get(c) ?? DEFAULT_COL_WIDTH;
        if (x < accX + w) { col = c; break; }
        accX += w;
        if (c === totalCols - 1) col = c;
      }
      col = Math.max(0, Math.min(col, totalCols - 1));

      // Find row from y using variable heights
      let row = 1;
      let accY = 0;
      for (let r = 1; r <= totalRows; r++) {
        const h = rowHeights.get(r) ?? DEFAULT_ROW_HEIGHT;
        if (y < accY + h) { row = r; break; }
        accY += h;
        if (r === totalRows) row = r;
      }
      row = Math.max(1, Math.min(row, totalRows));

      if (col !== selectionRange.endCol || row !== selectionRange.endRow) {
        onSelectionRangeChange({
          ...selectionRange,
          endCol: col,
          endRow: row,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, selectionRange, totalCols, totalRows, onSelectionRangeChange, colWidths, rowHeights]);

  // Column resize drag effect
  useEffect(() => {
    if (!resizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizingCol.startX;
      const newWidth = Math.max(30, resizingCol.startWidth + delta);
      setColWidths((prev) => {
        const next = new Map(prev);
        next.set(resizingCol.colIdx, newWidth);
        return next;
      });
    };
    const handleMouseUp = () => setResizingCol(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  // Row resize drag effect
  useEffect(() => {
    if (!resizingRow) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - resizingRow.startY;
      const newHeight = Math.max(16, resizingRow.startHeight + delta);
      setRowHeights((prev) => {
        const next = new Map(prev);
        next.set(resizingRow.rowNum, newHeight);
        return next;
      });
    };
    const handleMouseUp = () => setResizingRow(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingRow]);

  const handleColResizeStart = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol({ colIdx, startX: e.clientX, startWidth: getColWidth(colIdx) });
  }, [getColWidth]);

  const handleRowResizeStart = useCallback((rowNum: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingRow({ rowNum, startY: e.clientY, startHeight: getRowHeight(rowNum) });
  }, [getRowHeight]);

  const handleCellMouseDown = useCallback(
    (address: string, e: React.MouseEvent) => {
      // If we were editing a different cell, commit first
      if (editingAddress && editingAddress !== address) {
        commitEdit(false);
      }

      const pos = positionFromAddress(address);
      if (!pos) return;

      if (e.shiftKey && selectedPosition) {
        // Shift+Click: extend selection from anchor to this cell
        onSelectionRangeChange({
          startCol: selectedPosition.col,
          startRow: selectedPosition.row,
          endCol: pos.col,
          endRow: pos.row,
        });
      } else {
        // Normal click: set single-cell selection and start potential drag
        const cell = cells.get(address);
        onCellSelect(cell?.id ?? null, address);
        onSelectionRangeChange({
          startCol: pos.col,
          startRow: pos.row,
          endCol: pos.col,
          endRow: pos.row,
        });
        setIsDragging(true);
      }

      containerRef.current?.focus();
    },
    [cells, onCellSelect, editingAddress, commitEdit, selectedPosition, onSelectionRangeChange],
  );

  const handleCellDoubleClick = useCallback(
    (address: string) => {
      // Reset range on double click (entering edit mode)
      const pos = positionFromAddress(address);
      if (pos) {
        onSelectionRangeChange(null);
      }
      startEditing(address);
      onCellDoubleClick(address);
    },
    [startEditing, onCellDoubleClick, onSelectionRangeChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // If we're editing inline, don't handle grid navigation
      if (editingAddress) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+C: copy
      if (isMod && e.key === 'c') {
        e.preventDefault();
        onCopyCell();
        return;
      }

      // Ctrl/Cmd+V: paste
      if (isMod && e.key === 'v') {
        e.preventDefault();
        onPasteCell();
        return;
      }

      if (!selectedPosition) return;

      const { col, row } = selectedPosition;

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          const nextRow = Math.max(row - 1, 1);
          if (e.shiftKey) {
            const range = selectionRange ?? { startCol: col, startRow: row, endCol: col, endRow: row };
            onSelectionRangeChange({ ...range, endRow: Math.max(range.endRow - 1, 1) });
          } else {
            selectCell({ col, row: nextRow });
            onSelectionRangeChange(null);
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const nextRow = Math.min(row + 1, totalRows);
          if (e.shiftKey) {
            const range = selectionRange ?? { startCol: col, startRow: row, endCol: col, endRow: row };
            onSelectionRangeChange({ ...range, endRow: Math.min(range.endRow + 1, totalRows) });
          } else {
            selectCell({ col, row: nextRow });
            onSelectionRangeChange(null);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const nextCol = Math.max(col - 1, 0);
          if (e.shiftKey) {
            const range = selectionRange ?? { startCol: col, startRow: row, endCol: col, endRow: row };
            onSelectionRangeChange({ ...range, endCol: Math.max(range.endCol - 1, 0) });
          } else {
            selectCell({ col: nextCol, row });
            onSelectionRangeChange(null);
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const nextCol = Math.min(col + 1, totalCols - 1);
          if (e.shiftKey) {
            const range = selectionRange ?? { startCol: col, startRow: row, endCol: col, endRow: row };
            onSelectionRangeChange({ ...range, endCol: Math.min(range.endCol + 1, totalCols - 1) });
          } else {
            selectCell({ col: nextCol, row });
            onSelectionRangeChange(null);
          }
          break;
        }
        case 'Tab': {
          e.preventDefault();
          if (e.shiftKey) {
            const nextCol = Math.max(col - 1, 0);
            selectCell({ col: nextCol, row });
          } else {
            const nextCol = Math.min(col + 1, totalCols - 1);
            selectCell({ col: nextCol, row });
          }
          onSelectionRangeChange(null);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (e.shiftKey) {
            const nextRow = Math.max(row - 1, 1);
            selectCell({ col, row: nextRow });
          } else {
            const nextRow = Math.min(row + 1, totalRows);
            selectCell({ col, row: nextRow });
          }
          onSelectionRangeChange(null);
          break;
        }
        case 'Home': {
          e.preventDefault();
          selectCell({ col: 0, row });
          onSelectionRangeChange(null);
          break;
        }
        case 'End': {
          e.preventDefault();
          let lastDataCol = 0;
          for (let c = totalCols - 1; c >= 0; c--) {
            const addr = `${columnIndexToLabel(c)}${row}`;
            const cell = cells.get(addr);
            if (cell && cell.rawValue !== null && cell.rawValue !== '') {
              lastDataCol = c;
              break;
            }
          }
          selectCell({ col: Math.max(lastDataCol, col), row });
          onSelectionRangeChange(null);
          break;
        }
        case 'F2': {
          e.preventDefault();
          startEditing(addressFromPosition({ col, row }));
          onSelectionRangeChange(null);
          break;
        }
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          onDeleteCell();
          break;
        }
        case 'Escape': {
          // Clear multi-cell selection back to single cell
          if (selectionRange && isMultiCellRange(selectionRange)) {
            e.preventDefault();
            onSelectionRangeChange(null);
          }
          break;
        }
        default: {
          // If it's a printable character (single char, no modifier), start editing
          if (
            e.key.length === 1 &&
            !isMod &&
            !e.altKey
          ) {
            e.preventDefault();
            onSelectionRangeChange(null);
            startEditing(addressFromPosition({ col, row }), e.key);
          }
          break;
        }
      }
    },
    [
      editingAddress,
      selectedPosition,
      totalRows,
      totalCols,
      selectCell,
      startEditing,
      cells,
      onDeleteCell,
      onCopyCell,
      onPasteCell,
      selectionRange,
      onSelectionRangeChange,
    ],
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit(true);
        containerRef.current?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit(false);
        if (selectedPosition) {
          const nextCol = e.shiftKey
            ? Math.max(selectedPosition.col - 1, 0)
            : Math.min(selectedPosition.col + 1, totalCols - 1);
          selectCell({ col: nextCol, row: selectedPosition.row });
        }
        containerRef.current?.focus();
      }
    },
    [commitEdit, cancelEdit, selectedPosition, totalCols, selectCell],
  );

  // Calculate total table size for scrolling
  const totalWidth = useMemo(() => {
    let w = HEADER_WIDTH;
    for (let i = 0; i < totalCols; i++) w += colWidths.get(i) ?? DEFAULT_COL_WIDTH;
    return w;
  }, [totalCols, colWidths]);
  const totalHeight = useMemo(() => {
    let h = HEADER_HEIGHT;
    for (let i = 1; i <= totalRows; i++) h += rowHeights.get(i) ?? DEFAULT_ROW_HEIGHT;
    return h;
  }, [totalRows, rowHeights]);

  // Frozen pane dimensions
  const frozenColsWidth = useMemo(() => {
    let w = 0;
    for (let i = 0; i < freezeCols; i++) w += colWidths.get(i) ?? DEFAULT_COL_WIDTH;
    return w;
  }, [freezeCols, colWidths]);
  const frozenRowsHeight = useMemo(() => {
    let h = 0;
    for (let i = 1; i <= freezeRows; i++) h += rowHeights.get(i) ?? DEFAULT_ROW_HEIGHT;
    return h;
  }, [freezeRows, rowHeights]);

  // Build sets for header highlighting
  const highlightedCols = useMemo(() => {
    const set = new Set<number>();
    if (selectionRange) {
      const { minCol, maxCol } = normalizeRange(selectionRange);
      for (let c = minCol; c <= maxCol; c++) set.add(c);
    } else if (selectedPosition) {
      set.add(selectedPosition.col);
    }
    return set;
  }, [selectionRange, selectedPosition]);

  const highlightedRows = useMemo(() => {
    const set = new Set<number>();
    if (selectionRange) {
      const { minRow, maxRow } = normalizeRange(selectionRange);
      for (let r = minRow; r <= maxRow; r++) set.add(r);
    } else if (selectedPosition) {
      set.add(selectedPosition.row);
    }
    return set;
  }, [selectionRange, selectedPosition]);

  /** Render a single data cell */
  const renderCell = (col: string, colIdx: number, row: number) => {
    const address = `${col}${row}`;
    const cell = cells.get(address);
    const isSelected = selectedAddress === address;
    const isEditing = editingAddress === address;
    const isInRange = selectionRange ? isCellInRange(colIdx, row, selectionRange) : false;
    const isAnchor = selectionRange
      ? colIdx === selectionRange.startCol && row === selectionRange.startRow
      : false;
    const hasMultiRange = selectionRange ? isMultiCellRange(selectionRange) : false;

    const isFrozenCell = colIdx < freezeCols || row <= freezeRows;
    const rowBg = isFrozenCell
      ? COLORS.frozenBg
      : row % 2 === 0 ? COLORS.rowOdd : COLORS.rowEven;

    const displayVal = getDisplayValue(cell);
    const tooltipText = cell?.formula
      ? `${address}: ${cell.formula}`
      : displayVal
        ? `${address}: ${displayVal}`
        : address;

    let bg = rowBg;
    if (isEditing) {
      bg = COLORS.editBg;
    } else if (isInRange && hasMultiRange) {
      bg = COLORS.rangeBg;
    } else if (isSelected) {
      bg = COLORS.selectedBg;
    }

    let boxShadow = 'none';
    if (!isEditing) {
      if (isAnchor && hasMultiRange) {
        boxShadow = `inset 0 0 0 2px ${COLORS.selectedBorder}`;
      } else if (isSelected && !hasMultiRange) {
        boxShadow = `inset 0 0 0 2px ${COLORS.selectedBorder}`;
      }
    }

    const w = getColWidth(colIdx);
    const h = getRowHeight(row);

    // Thicker border on freeze boundary
    const borderRight = colIdx === freezeCols - 1
      ? `2px solid ${COLORS.freezeBorder}`
      : `1px solid ${COLORS.cellBorder}`;
    const borderBottom = row === freezeRows
      ? `2px solid ${COLORS.freezeBorder}`
      : `1px solid ${COLORS.cellBorder}`;

    return (
      <div
        key={address}
        onMouseDown={(e) => handleCellMouseDown(address, e)}
        onDoubleClick={() => handleCellDoubleClick(address)}
        title={tooltipText}
        style={{
          width: w,
          minWidth: w,
          maxWidth: w,
          height: h,
          borderBottom,
          borderRight,
          padding: (isSelected || isAnchor) && !isEditing ? '0 5px' : '0 6px',
          cursor: 'cell',
          background: bg,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: getCellTextAlign(cell?.valueType),
          color: getCellColor(cell?.valueType),
          fontSize: 12,
          boxSizing: 'border-box',
          position: 'relative',
          lineHeight: `${h}px`,
          boxShadow,
        }}
      >
        {isEditing ? null : displayVal}
        {/* Error fix button */}
        {!isEditing && cell?.valueType === 'error' && cell.formula && onFixError && (
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              onFixError(cell.id, cell.formula!, cell.displayValue);
            }}
            title="AI Fix: suggest a correction for this formula"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 18,
              height: 18,
              padding: 0,
              border: 'none',
              borderRadius: 3,
              background: '#fce8e6',
              color: '#d93025',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              zIndex: 5,
              fontFamily: 'inherit',
            }}
          >
            Fix
          </button>
        )}
        {isEditing && (
          <input
            ref={editInputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={() => commitEdit(false)}
            style={{
              position: 'absolute',
              top: -2,
              left: -2,
              width: w + 4,
              height: h + 4,
              border: `2px solid ${COLORS.selectedBorder}`,
              padding: '0 6px',
              fontFamily: 'inherit',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
              background: '#fff',
              zIndex: 10,
              lineHeight: `${h}px`,
              boxShadow: '0 2px 8px rgba(26, 115, 232, 0.2)',
            }}
          />
        )}
      </div>
    );
  };

  // Cursor override while resizing
  const resizeCursorStyle = resizingCol ? 'col-resize' : resizingRow ? 'row-resize' : undefined;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        overflow: 'auto',
        flex: 1,
        position: 'relative',
        outline: 'none',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        cursor: resizeCursorStyle,
      }}
    >
      <div style={{ width: totalWidth, height: totalHeight, position: 'relative' }}>
        {/* Corner header cell - sticky both ways */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            left: 0,
            width: HEADER_WIDTH,
            height: HEADER_HEIGHT,
            background: COLORS.headerBg,
            borderBottom: `1px solid ${COLORS.headerBorderBottom}`,
            borderRight: `1px solid ${COLORS.cellBorder}`,
            zIndex: 4,
            boxSizing: 'border-box',
          }}
        />

        {/* Column headers - sticky top */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            left: 0,
            zIndex: 3,
            height: HEADER_HEIGHT,
            width: totalWidth,
          }}
        >
          <div style={{ position: 'absolute', left: HEADER_WIDTH, top: 0, display: 'flex' }}>
            {columns.map((col, colIdx) => {
              const isColHighlighted = highlightedCols.has(colIdx);
              const w = getColWidth(colIdx);
              const isFrozenCol = colIdx < freezeCols;
              return (
                <div
                  key={col}
                  style={{
                    width: w,
                    minWidth: w,
                    maxWidth: w,
                    height: HEADER_HEIGHT,
                    background: isColHighlighted ? COLORS.headerSelectedBg : isFrozenCol ? COLORS.frozenBg : COLORS.headerBg,
                    borderBottom: `1px solid ${COLORS.headerBorderBottom}`,
                    borderRight: colIdx === freezeCols - 1 ? `2px solid ${COLORS.freezeBorder}` : `1px solid ${COLORS.cellBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 500,
                    fontSize: 11,
                    color: isColHighlighted ? COLORS.headerSelectedText : COLORS.headerText,
                    boxSizing: 'border-box',
                    userSelect: 'none',
                    letterSpacing: '0.02em',
                    position: 'relative',
                  }}
                >
                  {col}
                  {/* Column resize handle */}
                  <div
                    onMouseDown={(e) => handleColResizeStart(colIdx, e)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: RESIZE_HANDLE_SIZE,
                      height: '100%',
                      cursor: 'col-resize',
                      zIndex: 1,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(26,115,232,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Row headers - sticky left */}
        <div
          style={{
            position: 'sticky',
            left: 0,
            zIndex: 2,
            width: HEADER_WIDTH,
            top: HEADER_HEIGHT,
          }}
        >
          {rows.map((row) => {
            const isRowHighlighted = highlightedRows.has(row);
            const h = getRowHeight(row);
            const topOffset = getRowTop(row, rowHeights);
            const isFrozenRow = row <= freezeRows;
            return (
              <div
                key={row}
                style={{
                  position: 'absolute',
                  top: topOffset,
                  left: 0,
                  width: HEADER_WIDTH,
                  height: h,
                  background: isRowHighlighted ? COLORS.headerSelectedBg : isFrozenRow ? COLORS.frozenBg : (row % 2 === 0 ? COLORS.rowOdd : COLORS.headerBg),
                  borderBottom: row === freezeRows ? `2px solid ${COLORS.freezeBorder}` : `1px solid ${COLORS.cellBorder}`,
                  borderRight: `1px solid ${COLORS.cellBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 400,
                  fontSize: 11,
                  color: isRowHighlighted ? COLORS.headerSelectedText : COLORS.headerText,
                  boxSizing: 'border-box',
                  userSelect: 'none',
                }}
              >
                {row}
                {/* Row resize handle */}
                <div
                  onMouseDown={(e) => handleRowResizeStart(row, e)}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: RESIZE_HANDLE_SIZE,
                    cursor: 'row-resize',
                    zIndex: 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(26,115,232,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Cell area */}
        <div
          style={{
            position: 'absolute',
            top: HEADER_HEIGHT,
            left: HEADER_WIDTH,
          }}
        >
          {rows.map((row) => {
            const h = getRowHeight(row);
            return (
              <div key={row} style={{ display: 'flex', height: h }}>
                {columns.map((col, colIdx) => renderCell(col, colIdx, row))}
              </div>
            );
          })}
        </div>

        {/* Frozen column overlay - sticky left cells */}
        {freezeCols > 0 && (
          <div
            style={{
              position: 'sticky',
              left: HEADER_WIDTH,
              top: HEADER_HEIGHT,
              width: frozenColsWidth,
              height: totalHeight - HEADER_HEIGHT,
              pointerEvents: 'none',
              zIndex: 1,
              marginTop: -(totalHeight - HEADER_HEIGHT),
            }}
          />
        )}

        {/* Frozen row overlay - sticky top cells */}
        {freezeRows > 0 && (
          <div
            style={{
              position: 'sticky',
              top: HEADER_HEIGHT,
              left: HEADER_WIDTH,
              width: totalWidth - HEADER_WIDTH,
              height: frozenRowsHeight,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </div>
    </div>
  );
};
