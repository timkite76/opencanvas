import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/** Complete list of built-in spreadsheet functions with signatures */
const BUILTIN_FUNCTIONS: Array<{ name: string; signature: string; description: string }> = [
  { name: 'SUM', signature: 'SUM(range)', description: 'Adds all numbers in a range' },
  { name: 'AVERAGE', signature: 'AVERAGE(range)', description: 'Calculates the mean of a range' },
  { name: 'MIN', signature: 'MIN(range)', description: 'Returns the smallest number' },
  { name: 'MAX', signature: 'MAX(range)', description: 'Returns the largest number' },
  { name: 'COUNT', signature: 'COUNT(range)', description: 'Counts numeric values' },
  { name: 'IF', signature: 'IF(condition, true_val, false_val)', description: 'Conditional evaluation' },
  { name: 'CONCAT', signature: 'CONCAT(text1, text2, ...)', description: 'Joins text strings' },
  { name: 'ABS', signature: 'ABS(number)', description: 'Returns absolute value' },
  { name: 'ROUND', signature: 'ROUND(number, digits)', description: 'Rounds to specified digits' },
  { name: 'FLOOR', signature: 'FLOOR(number)', description: 'Rounds down to nearest integer' },
  { name: 'CEILING', signature: 'CEILING(number)', description: 'Rounds up to nearest integer' },
  { name: 'MOD', signature: 'MOD(number, divisor)', description: 'Returns remainder of division' },
  { name: 'POWER', signature: 'POWER(base, exponent)', description: 'Raises base to a power' },
  { name: 'SQRT', signature: 'SQRT(number)', description: 'Returns the square root' },
  { name: 'INT', signature: 'INT(number)', description: 'Truncates to integer' },
  { name: 'LEN', signature: 'LEN(text)', description: 'Returns length of text' },
  { name: 'LEFT', signature: 'LEFT(text, count)', description: 'Returns leftmost characters' },
  { name: 'RIGHT', signature: 'RIGHT(text, count)', description: 'Returns rightmost characters' },
  { name: 'MID', signature: 'MID(text, start, count)', description: 'Returns characters from middle' },
  { name: 'UPPER', signature: 'UPPER(text)', description: 'Converts to uppercase' },
  { name: 'LOWER', signature: 'LOWER(text)', description: 'Converts to lowercase' },
  { name: 'TRIM', signature: 'TRIM(text)', description: 'Removes extra whitespace' },
  { name: 'SUBSTITUTE', signature: 'SUBSTITUTE(text, old, new)', description: 'Replaces text occurrences' },
  { name: 'AND', signature: 'AND(value1, value2, ...)', description: 'Returns TRUE if all arguments are true' },
  { name: 'OR', signature: 'OR(value1, value2, ...)', description: 'Returns TRUE if any argument is true' },
  { name: 'NOT', signature: 'NOT(value)', description: 'Reverses a boolean' },
  { name: 'IFERROR', signature: 'IFERROR(value, fallback)', description: 'Returns fallback if value is an error' },
  { name: 'COUNTA', signature: 'COUNTA(range)', description: 'Counts non-empty values' },
  { name: 'COUNTIF', signature: 'COUNTIF(range, criteria)', description: 'Counts values matching criteria' },
  { name: 'SUMIF', signature: 'SUMIF(range, criteria, sum_range)', description: 'Sums values matching criteria' },
];

interface FormulaBarProps {
  cellAddress: string | null;
  cellFormula: string | null;
  cellRawValue: string | number | boolean | null;
  onFormulaSubmit: (value: string) => void;
  onNavigateToCell?: (address: string) => void;
  /** AI mode: called when user submits a natural language description */
  onAiGenerate?: (description: string) => void;
  /** AI-generated formula preview to display */
  aiPreview?: string | null;
  /** Whether AI is currently generating */
  aiLoading?: boolean;
  /** Called when user accepts the AI preview */
  onAiAccept?: () => void;
  /** Called when user rejects the AI preview */
  onAiReject?: () => void;
}

export const FormulaBar: React.FC<FormulaBarProps> = ({
  cellAddress,
  cellFormula,
  cellRawValue,
  onFormulaSubmit,
  onNavigateToCell,
  onAiGenerate,
  aiPreview,
  aiLoading,
  onAiAccept,
  onAiReject,
}) => {
  const displayText = cellFormula ?? (cellRawValue === null ? '' : String(cellRawValue));
  const [editValue, setEditValue] = useState(displayText);
  const [nameBoxValue, setNameBoxValue] = useState(cellAddress ?? '');
  const [nameBoxEditing, setNameBoxEditing] = useState(false);
  const nameBoxRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const [formulaFocused, setFormulaFocused] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiDescription, setAiDescription] = useState('');

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aiMode) {
      setEditValue(cellFormula ?? (cellRawValue === null ? '' : String(cellRawValue)));
    }
  }, [cellAddress, cellFormula, cellRawValue, aiMode]);

  useEffect(() => {
    if (!nameBoxEditing) {
      setNameBoxValue(cellAddress ?? '');
    }
  }, [cellAddress, nameBoxEditing]);

  // Extract the function name being typed for autocomplete
  const currentFunctionPrefix = useMemo(() => {
    if (aiMode) return '';
    if (!editValue.startsWith('=')) return '';
    // Find the last function name being typed (after = or ( or , or operator)
    const match = /(?:^=|[,(+\-*/])([A-Z]+)$/i.exec(editValue);
    return match ? match[1]!.toUpperCase() : '';
  }, [editValue, aiMode]);

  const filteredFunctions = useMemo(() => {
    if (!currentFunctionPrefix || currentFunctionPrefix.length < 1) return [];
    return BUILTIN_FUNCTIONS.filter((fn) =>
      fn.name.startsWith(currentFunctionPrefix),
    ).slice(0, 8);
  }, [currentFunctionPrefix]);

  // Show autocomplete when we have matches and formula is focused
  useEffect(() => {
    if (filteredFunctions.length > 0 && formulaFocused && !aiMode) {
      setShowAutocomplete(true);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  }, [filteredFunctions, formulaFocused, aiMode]);

  const insertAutocomplete = useCallback(
    (funcName: string) => {
      // Replace the partial function name with the full name + opening paren
      const match = /(?:^=|[,(+\-*/])([A-Z]+)$/i.exec(editValue);
      if (match) {
        const prefixLen = match[1]!.length;
        const newValue = editValue.slice(0, editValue.length - prefixLen) + funcName + '(';
        setEditValue(newValue);
      }
      setShowAutocomplete(false);
      formulaInputRef.current?.focus();
    },
    [editValue],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showAutocomplete && filteredFunctions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setAutocompleteIndex((prev) => Math.min(prev + 1, filteredFunctions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setAutocompleteIndex((prev) => Math.max(prev - 1, 0));
          return;
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && filteredFunctions.length > 0 && currentFunctionPrefix.length > 0)) {
          // Only intercept Enter for autocomplete if we have a partial function name
          // and the user hasn't typed a complete valid entry
          const selected = filteredFunctions[autocompleteIndex];
          if (selected && currentFunctionPrefix.length > 0 && selected.name !== currentFunctionPrefix) {
            e.preventDefault();
            insertAutocomplete(selected.name);
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowAutocomplete(false);
          return;
        }
      }
      if (e.key === 'Enter') {
        if (aiMode) {
          if (aiDescription.trim() && onAiGenerate) {
            onAiGenerate(aiDescription.trim());
          }
        } else {
          onFormulaSubmit(editValue);
        }
      }
    },
    [
      editValue,
      onFormulaSubmit,
      aiMode,
      aiDescription,
      onAiGenerate,
      showAutocomplete,
      filteredFunctions,
      autocompleteIndex,
      currentFunctionPrefix,
      insertAutocomplete,
    ],
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
    setTimeout(() => nameBoxRef.current?.select(), 0);
  }, []);

  const handleNameBoxBlur = useCallback(() => {
    setNameBoxEditing(false);
    setNameBoxValue(cellAddress ?? '');
  }, [cellAddress]);

  const toggleAiMode = useCallback(() => {
    setAiMode((prev) => !prev);
    setAiDescription('');
    setShowAutocomplete(false);
  }, []);

  const hasAiPreview = aiPreview && aiMode;

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
        position: 'relative',
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

      {/* fx / AI toggle */}
      <button
        onClick={toggleAiMode}
        title={aiMode ? 'Switch to formula mode' : 'Switch to AI mode'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          minWidth: 40,
          height: 30,
          borderRight: '1px solid #c0c0c0',
          border: 'none',
          borderRightStyle: 'solid',
          borderRightWidth: 1,
          borderRightColor: '#c0c0c0',
          color: aiMode ? '#1a73e8' : '#5f6368',
          fontWeight: 600,
          fontSize: 11,
          userSelect: 'none',
          background: aiMode ? '#e8f0fe' : '#ffffff',
          cursor: 'pointer',
          fontFamily: aiMode ? 'inherit' : 'serif',
          fontStyle: aiMode ? 'normal' : 'italic',
          transition: 'background 0.15s, color 0.15s',
          padding: 0,
        }}
      >
        {aiMode ? 'AI' : 'fx'}
      </button>

      {/* Formula / AI input */}
      {aiMode ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 30, position: 'relative' }}>
          <input
            type="text"
            value={hasAiPreview ? aiPreview : aiDescription}
            onChange={(e) => {
              if (!hasAiPreview) setAiDescription(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            disabled={!cellAddress || aiLoading}
            readOnly={!!hasAiPreview}
            style={{
              flex: 1,
              height: 30,
              border: 'none',
              padding: '0 8px',
              fontSize: 13,
              fontFamily: hasAiPreview
                ? '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace'
                : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              outline: 'none',
              background: hasAiPreview ? '#f0f7ff' : '#ffffff',
              color: hasAiPreview ? '#1a73e8' : '#202124',
              boxSizing: 'border-box',
              boxShadow: 'inset 0 -2px 0 0 #1a73e8',
            }}
            placeholder={
              aiLoading
                ? 'Generating formula...'
                : cellAddress
                  ? 'Describe what you want to calculate...'
                  : 'Select a cell'
            }
          />
          {hasAiPreview && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 4 }}>
              <button
                onClick={onAiAccept}
                title="Accept formula"
                style={{
                  height: 22,
                  padding: '0 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  background: '#1e8e3e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Accept
              </button>
              <button
                onClick={() => {
                  onAiReject?.();
                  setAiDescription('');
                }}
                title="Reject formula"
                style={{
                  height: 22,
                  padding: '0 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  background: '#fff',
                  color: '#5f6368',
                  border: '1px solid #dadce0',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', height: 30 }}>
          <input
            ref={formulaInputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFormulaFocused(true)}
            onBlur={() => {
              // Delay hiding autocomplete so click events on dropdown items can fire
              setTimeout(() => {
                setFormulaFocused(false);
                setShowAutocomplete(false);
              }, 200);
            }}
            disabled={!cellAddress}
            style={{
              width: '100%',
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

          {/* Autocomplete dropdown */}
          {showAutocomplete && filteredFunctions.length > 0 && (
            <div
              ref={autocompleteRef}
              style={{
                position: 'absolute',
                top: 30,
                left: 0,
                width: 340,
                maxHeight: 240,
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid #dadce0',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 100,
                fontSize: 12,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              {filteredFunctions.map((fn, idx) => (
                <div
                  key={fn.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertAutocomplete(fn.name);
                  }}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    background: idx === autocompleteIndex ? '#e8f0fe' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    borderBottom: idx < filteredFunctions.length - 1 ? '1px solid #f1f3f4' : 'none',
                  }}
                  onMouseEnter={() => setAutocompleteIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: '#1a73e8',
                        fontFamily: '"SF Mono", "Fira Code", Menlo, Consolas, monospace',
                        fontSize: 11,
                      }}
                    >
                      {fn.signature}
                    </span>
                  </div>
                  <span style={{ color: '#5f6368', fontSize: 11 }}>{fn.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
