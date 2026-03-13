import React, { useMemo, useCallback } from 'react';
import type { CellNode, WorksheetNode } from '@opencanvas/grid-model';
import { columnIndexToLabel } from '@opencanvas/grid-model';

interface VirtualGridProps {
  worksheet: WorksheetNode;
  cells: Map<string, CellNode>;
  selectedCellId: string | null;
  onCellSelect: (cellId: string | null, address: string) => void;
  onCellDoubleClick: (address: string) => void;
}

const COL_WIDTH = 100;
const ROW_HEIGHT = 28;
const HEADER_WIDTH = 48;
const VISIBLE_COLS = 10;
const VISIBLE_ROWS = 20;

export const VirtualGrid: React.FC<VirtualGridProps> = ({
  worksheet,
  cells,
  selectedCellId,
  onCellSelect,
  onCellDoubleClick,
}) => {
  const columns = useMemo(() => {
    const cols: string[] = [];
    for (let i = 0; i < Math.min(worksheet.columnCount, VISIBLE_COLS); i++) {
      cols.push(columnIndexToLabel(i));
    }
    return cols;
  }, [worksheet.columnCount]);

  const rows = useMemo(() => {
    const r: number[] = [];
    for (let i = 1; i <= Math.min(worksheet.rowCount, VISIBLE_ROWS); i++) {
      r.push(i);
    }
    return r;
  }, [worksheet.rowCount]);

  const handleCellClick = useCallback(
    (address: string) => {
      const cell = cells.get(address);
      onCellSelect(cell?.id ?? null, address);
    },
    [cells, onCellSelect],
  );

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <table
        style={{
          borderCollapse: 'collapse',
          fontFamily: '"Courier New", monospace',
          fontSize: 13,
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: HEADER_WIDTH,
                minWidth: HEADER_WIDTH,
                background: '#f5f5f5',
                border: '1px solid #ddd',
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 3,
              }}
            />
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  width: COL_WIDTH,
                  minWidth: COL_WIDTH,
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  padding: '4px 8px',
                  fontWeight: 600,
                  fontSize: 12,
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <td
                style={{
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  padding: '4px 8px',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: 12,
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                }}
              >
                {row}
              </td>
              {columns.map((col) => {
                const address = `${col}${row}`;
                const cell = cells.get(address);
                const isSelected = cell?.id === selectedCellId && selectedCellId !== null;

                return (
                  <td
                    key={address}
                    onClick={() => handleCellClick(address)}
                    onDoubleClick={() => onCellDoubleClick(address)}
                    style={{
                      border: isSelected ? '2px solid #1a73e8' : '1px solid #ddd',
                      padding: isSelected ? '3px 7px' : '4px 8px',
                      height: ROW_HEIGHT,
                      cursor: 'cell',
                      background: isSelected ? '#e8f0fe' : '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign:
                        cell?.valueType === 'number' ? 'right' : 'left',
                      color: cell?.valueType === 'error' ? '#d32f2f' : '#222',
                    }}
                    title={cell?.formula ? `Formula: ${cell.formula}` : undefined}
                  >
                    {cell?.displayValue ?? ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
