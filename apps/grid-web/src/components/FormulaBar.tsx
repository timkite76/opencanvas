import React, { useState, useEffect, useCallback, useRef } from 'react';

interface FormulaBarProps {
  cellAddress: string | null;
  cellFormula: string | null;
  cellRawValue: string | number | boolean | null;
  onFormulaSubmit: (value: string) => void;
  onNavigateToCell?: (address: string) => void;
}

export const FormulaBar: React.FC<FormulaBarProps> = ({
  cellAddress,
  cellFormula,
  cellRawValue,
  onFormulaSubmit,
  onNavigateToCell,
}) => {
  const displayText = cellFormula ?? (cellRawValue === null ? '' : String(cellRawValue));
  const [editValue, setEditValue] = useState(displayText);
  const [nameBoxValue, setNameBoxValue] = useState(cellAddress ?? '');
  const [nameBoxEditing, setNameBoxEditing] = useState(false);
  const nameBoxRef = useRef<HTMLInputElement>(null);
  const [formulaFocused, setFormulaFocused] = useState(false);

  useEffect(() => {
    setEditValue(cellFormula ?? (cellRawValue === null ? '' : String(cellRawValue)));
  }, [cellAddress, cellFormula, cellRawValue]);

  useEffect(() => {
    if (!nameBoxEditing) {
      setNameBoxValue(cellAddress ?? '');
    }
  }, [cellAddress, nameBoxEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onFormulaSubmit(editValue);
      }
    },
    [editValue, onFormulaSubmit],
  );

  const handleNameBoxKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const addr = nameBoxValue.trim().toUpperCase();
        if (addr && onNavigateToCell) {
          onNavigateToCell(addr);
        }
        setNameBoxEditing(false);
        nameBoxRef.current?.blur();
      } else if (e.key === 'Escape') {
        setNameBoxEditing(false);
        setNameBoxValue(cellAddress ?? '');
        nameBoxRef.current?.blur();
      }
    },
    [nameBoxValue, onNavigateToCell, cellAddress],
  );

  const handleNameBoxFocus = useCallback(() => {
    setNameBoxEditing(true);
    // Select all text on focus
    setTimeout(() => nameBoxRef.current?.select(), 0);
  }, []);

  const handleNameBoxBlur = useCallback(() => {
    setNameBoxEditing(false);
    setNameBoxValue(cellAddress ?? '');
  }, [cellAddress]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: 0,
        borderBottom: '1px solid #c0c0c0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 13,
        background: '#ffffff',
        height: 30,
      }}
    >
      {/* Name Box (cell address) */}
      <input
        ref={nameBoxRef}
        type="text"
        value={nameBoxEditing ? nameBoxValue : (cellAddress ?? '')}
        onChange={(e) => setNameBoxValue(e.target.value)}
        onKeyDown={handleNameBoxKeyDown}
        onFocus={handleNameBoxFocus}
        onBlur={handleNameBoxBlur}
        style={{
          width: 62,
          minWidth: 62,
          height: 30,
          border: 'none',
          borderRight: '1px solid #c0c0c0',
          padding: '0 8px',
          fontWeight: 500,
          fontSize: 12,
          textAlign: 'center',
          color: '#202124',
          background: nameBoxEditing ? '#e8f0fe' : '#ffffff',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          cursor: 'text',
        }}
        title="Name Box - click to type a cell address"
      />

      {/* fx label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          minWidth: 28,
          height: 30,
          borderRight: '1px solid #c0c0c0',
          color: '#5f6368',
          fontStyle: 'italic',
          fontWeight: 600,
          fontSize: 13,
          userSelect: 'none',
          background: '#ffffff',
        }}
      >
        <span style={{ fontFamily: 'serif' }}>fx</span>
      </div>

      {/* Formula input */}
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFormulaFocused(true)}
        onBlur={() => setFormulaFocused(false)}
        disabled={!cellAddress}
        style={{
          flex: 1,
          height: 30,
          border: 'none',
          padding: '0 8px',
          fontSize: 13,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          outline: 'none',
          background: formulaFocused ? '#fff' : '#ffffff',
          color: '#202124',
          boxSizing: 'border-box',
          boxShadow: formulaFocused ? 'inset 0 -2px 0 0 #1a73e8' : 'none',
        }}
        placeholder={cellAddress ? 'Enter value or formula (e.g. =SUM(A1:A3))' : 'Select a cell'}
      />
    </div>
  );
};
