import React, { useState, useEffect, useCallback } from 'react';

interface FormulaBarProps {
  cellAddress: string | null;
  cellFormula: string | null;
  cellRawValue: string | number | boolean | null;
  onFormulaSubmit: (value: string) => void;
}

export const FormulaBar: React.FC<FormulaBarProps> = ({
  cellAddress,
  cellFormula,
  cellRawValue,
  onFormulaSubmit,
}) => {
  const displayText = cellFormula ?? (cellRawValue === null ? '' : String(cellRawValue));
  const [editValue, setEditValue] = useState(displayText);

  useEffect(() => {
    setEditValue(cellFormula ?? (cellRawValue === null ? '' : String(cellRawValue)));
  }, [cellAddress, cellFormula, cellRawValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onFormulaSubmit(editValue);
      }
    },
    [editValue, onFormulaSubmit],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        borderBottom: '1px solid #ddd',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        background: '#fafafa',
      }}
    >
      <span
        style={{
          fontWeight: 600,
          minWidth: 48,
          textAlign: 'center',
          color: '#333',
        }}
      >
        {cellAddress ?? '--'}
      </span>
      <span style={{ color: '#ccc' }}>|</span>
      <span style={{ fontStyle: 'italic', color: '#999', fontSize: 12 }}>fx</span>
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!cellAddress}
        style={{
          flex: 1,
          border: '1px solid #ccc',
          borderRadius: 3,
          padding: '3px 8px',
          fontSize: 13,
          fontFamily: '"Courier New", monospace',
          outline: 'none',
        }}
        placeholder={cellAddress ? 'Enter value or formula (e.g. =SUM(A1:A3))' : 'Select a cell'}
      />
    </div>
  );
};
