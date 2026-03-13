import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import type { CellNode, WorksheetNode } from '@opencanvas/grid-model';
import { columnIndexToLabel, columnLabelToIndex, parseCellAddress } from '@opencanvas/grid-model';

export interface GridPosition {
  col: number; // 0-based column index
  row: number; // 1-based row number
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
}

const COL_WIDTH = 100;
const ROW_HEIGHT = 28;
const HEADER_WIDTH = 48;
const HEADER_HEIGHT = 28;

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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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
      // Move cursor to end
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

  const handleCellClick = useCallback(
    (address: string) => {
      // If we were editing a different cell, commit first
      if (editingAddress && editingAddress !== address) {
        commitEdit(false);
      }
      const cell = cells.get(address);
      onCellSelect(cell?.id ?? null, address);
      containerRef.current?.focus();
    },
    [cells, onCellSelect, editingAddress, commitEdit],
  );

  const handleCellDoubleClick = useCallback(
    (address: string) => {
      startEditing(address);
      onCellDoubleClick(address);
    },
    [startEditing, onCellDoubleClick],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // If we're editing inline, don't handle grid navigation
      if (editingAddress) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+C: copy cell
      if (isMod && e.key === 'c') {
        e.preventDefault();
        onCopyCell();
        return;
      }

      // Ctrl/Cmd+V: paste cell
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
          selectCell({ col, row: nextRow });
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const nextRow = Math.min(row + 1, totalRows);
          selectCell({ col, row: nextRow });
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const nextCol = Math.max(col - 1, 0);
          selectCell({ col: nextCol, row });
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const nextCol = Math.min(col + 1, totalCols - 1);
          selectCell({ col: nextCol, row });
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
          break;
        }
        case 'Home': {
          e.preventDefault();
          selectCell({ col: 0, row });
          break;
        }
        case 'End': {
          e.preventDefault();
          // Go to last column that has data in this row, or last column
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
          break;
        }
        case 'F2': {
          e.preventDefault();
          startEditing(addressFromPosition({ col, row }));
          break;
        }
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          onDeleteCell();
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
            background: '#f5f5f5',
            border: '1px solid #ddd',
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
            {columns.map((col) => (
              <div
                key={col}
                style={{
                  width: COL_WIDTH,
                  height: HEADER_HEIGHT,
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderLeft: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 12,
                  fontFamily: '"Courier New", monospace',
                  boxSizing: 'border-box',
                }}
              >
                {col}
              </div>
            ))}
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
          {rows.map((row) => (
            <div
              key={row}
              style={{
                position: 'absolute',
                top: (row - 1) * ROW_HEIGHT,
                left: 0,
                width: HEADER_WIDTH,
                height: ROW_HEIGHT,
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderTop: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 12,
                fontFamily: '"Courier New", monospace',
                boxSizing: 'border-box',
              }}
            >
              {row}
            </div>
          ))}
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
              {columns.map((col) => {
                const address = `${col}${row}`;
                const cell = cells.get(address);
                const isSelected =
                  selectedAddress === address;
                const isEditing = editingAddress === address;

                return (
                  <div
                    key={address}
                    onClick={() => handleCellClick(address)}
                    onDoubleClick={() => handleCellDoubleClick(address)}
                    style={{
                      width: COL_WIDTH,
                      height: ROW_HEIGHT,
                      border: isSelected
                        ? '2px solid #1a73e8'
                        : '1px solid #ddd',
                      padding: isSelected ? '3px 7px' : '4px 8px',
                      cursor: 'cell',
                      background: isSelected ? '#e8f0fe' : '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign:
                        cell?.valueType === 'number' ? 'right' : 'left',
                      color:
                        cell?.valueType === 'error' ? '#d32f2f' : '#222',
                      fontFamily: '"Courier New", monospace',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      position: 'relative',
                      lineHeight: `${ROW_HEIGHT - 8}px`,
                    }}
                    title={
                      cell?.formula
                        ? `Formula: ${cell.formula}`
                        : undefined
                    }
                  >
                    {isEditing ? null : (cell?.displayValue ?? '')}
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
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: '2px solid #1a73e8',
                          padding: '3px 7px',
                          fontFamily: '"Courier New", monospace',
                          fontSize: 13,
                          outline: 'none',
                          boxSizing: 'border-box',
                          background: '#fff',
                          zIndex: 10,
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
