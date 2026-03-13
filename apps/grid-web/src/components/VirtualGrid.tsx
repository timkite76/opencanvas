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
}

const COL_WIDTH = 100;
const ROW_HEIGHT = 24;
const HEADER_WIDTH = 46;
const HEADER_HEIGHT = 24;

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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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
    const cellLeft = HEADER_WIDTH + selectedPosition.col * COL_WIDTH;
    const cellTop = HEADER_HEIGHT + (selectedPosition.row - 1) * ROW_HEIGHT;
    const cellRight = cellLeft + COL_WIDTH;
    const cellBottom = cellTop + ROW_HEIGHT;

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
  }, [selectedPosition]);

  // Mouse drag support: track mouse move while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !selectionRange) return;
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      const x = e.clientX - rect.left + container.scrollLeft - HEADER_WIDTH;
      const y = e.clientY - rect.top + container.scrollTop - HEADER_HEIGHT;

      const col = Math.max(0, Math.min(Math.floor(x / COL_WIDTH), totalCols - 1));
      const row = Math.max(1, Math.min(Math.floor(y / ROW_HEIGHT) + 1, totalRows));

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
  }, [isDragging, selectionRange, totalCols, totalRows, onSelectionRangeChange]);

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
  const totalWidth = HEADER_WIDTH + totalCols * COL_WIDTH;
  const totalHeight = HEADER_HEIGHT + totalRows * ROW_HEIGHT;

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
              return (
                <div
                  key={col}
                  style={{
                    width: COL_WIDTH,
                    height: HEADER_HEIGHT,
                    background: isColHighlighted ? COLORS.headerSelectedBg : COLORS.headerBg,
                    borderBottom: `1px solid ${COLORS.headerBorderBottom}`,
                    borderRight: `1px solid ${COLORS.cellBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 500,
                    fontSize: 11,
                    color: isColHighlighted ? COLORS.headerSelectedText : COLORS.headerText,
                    boxSizing: 'border-box',
                    userSelect: 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  {col}
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
            return (
              <div
                key={row}
                style={{
                  position: 'absolute',
                  top: (row - 1) * ROW_HEIGHT,
                  left: 0,
                  width: HEADER_WIDTH,
                  height: ROW_HEIGHT,
                  background: isRowHighlighted ? COLORS.headerSelectedBg : (row % 2 === 0 ? COLORS.rowOdd : COLORS.headerBg),
                  borderBottom: `1px solid ${COLORS.cellBorder}`,
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
          {rows.map((row) => (
            <div key={row} style={{ display: 'flex' }}>
              {columns.map((col, colIdx) => {
                const address = `${col}${row}`;
                const cell = cells.get(address);
                const isSelected = selectedAddress === address;
                const isEditing = editingAddress === address;
                const isInRange = selectionRange ? isCellInRange(colIdx, row, selectionRange) : false;
                const isAnchor = selectionRange
                  ? colIdx === selectionRange.startCol && row === selectionRange.startRow
                  : false;
                const hasMultiRange = selectionRange ? isMultiCellRange(selectionRange) : false;
                const rowBg = row % 2 === 0 ? COLORS.rowOdd : COLORS.rowEven;

                const displayVal = getDisplayValue(cell);
                const tooltipText = cell?.formula
                  ? `${address}: ${cell.formula}`
                  : displayVal
                    ? `${address}: ${displayVal}`
                    : address;

                // Determine background
                let bg = rowBg;
                if (isEditing) {
                  bg = COLORS.editBg;
                } else if (isInRange && hasMultiRange) {
                  bg = COLORS.rangeBg;
                } else if (isSelected) {
                  bg = COLORS.selectedBg;
                }

                // Determine box shadow for selection outline
                let boxShadow = 'none';
                if (!isEditing) {
                  if (isAnchor && hasMultiRange) {
                    // Anchor cell in multi-range: darker border
                    boxShadow = `inset 0 0 0 2px ${COLORS.selectedBorder}`;
                  } else if (isSelected && !hasMultiRange) {
                    // Single cell selection
                    boxShadow = `inset 0 0 0 2px ${COLORS.selectedBorder}`;
                  }
                }

                return (
                  <div
                    key={address}
                    onMouseDown={(e) => handleCellMouseDown(address, e)}
                    onDoubleClick={() => handleCellDoubleClick(address)}
                    title={tooltipText}
                    style={{
                      width: COL_WIDTH,
                      height: ROW_HEIGHT,
                      borderBottom: `1px solid ${COLORS.cellBorder}`,
                      borderRight: `1px solid ${COLORS.cellBorder}`,
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
                      lineHeight: `${ROW_HEIGHT}px`,
                      boxShadow,
                    }}
                  >
                    {isEditing ? null : displayVal}
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
                          width: COL_WIDTH + 4,
                          height: ROW_HEIGHT + 4,
                          border: `2px solid ${COLORS.selectedBorder}`,
                          padding: '0 6px',
                          fontFamily: 'inherit',
                          fontSize: 12,
                          outline: 'none',
                          boxSizing: 'border-box',
                          background: '#fff',
                          zIndex: 10,
                          lineHeight: `${ROW_HEIGHT}px`,
                          boxShadow: '0 2px 8px rgba(26, 115, 232, 0.2)',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
