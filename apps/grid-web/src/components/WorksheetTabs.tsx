import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { WorksheetNode } from '@opencanvas/grid-model';

interface WorksheetTabsProps {
  worksheets: WorksheetNode[];
  activeWorksheetId: string | null;
  onSelectWorksheet: (worksheetId: string) => void;
  onAddWorksheet?: () => void;
  onRenameWorksheet?: (worksheetId: string, newName: string) => void;
}

export const WorksheetTabs: React.FC<WorksheetTabsProps> = ({
  worksheets,
  activeWorksheetId,
  onSelectWorksheet,
  onAddWorksheet,
  onRenameWorksheet,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [addHovered, setAddHovered] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = useCallback(
    (ws: WorksheetNode) => {
      if (onRenameWorksheet) {
        setEditingId(ws.id);
        setEditName(ws.name);
      }
    },
    [onRenameWorksheet],
  );

  const commitRename = useCallback(() => {
    if (editingId && editName.trim() && onRenameWorksheet) {
      onRenameWorksheet(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  }, [editingId, editName, onRenameWorksheet]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitRename();
      } else if (e.key === 'Escape') {
        setEditingId(null);
        setEditName('');
      }
    },
    [commitRename],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        borderTop: '1px solid #dadce0',
        background: '#f8f9fa',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 12,
        padding: '0 4px',
        minHeight: 32,
        gap: 0,
      }}
    >
      {/* Add worksheet button */}
      {onAddWorksheet && (
        <button
          onClick={onAddWorksheet}
          title="Add worksheet"
          onMouseEnter={() => setAddHovered(true)}
          onMouseLeave={() => setAddHovered(false)}
          style={{
            width: 28,
            height: 28,
            border: 'none',
            background: addHovered ? '#e8eaed' : 'transparent',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 16,
            color: '#5f6368',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 4,
            transition: 'background 0.15s',
          }}
        >
          +
        </button>
      )}

      {worksheets.map((ws) => {
        const isActive = ws.id === activeWorksheetId;
        const isHovered = ws.id === hoveredId;
        const isEditing = ws.id === editingId;

        return (
          <div
            key={ws.id}
            onClick={() => {
              if (!isEditing) onSelectWorksheet(ws.id);
            }}
            onDoubleClick={() => handleDoubleClick(ws)}
            onMouseEnter={() => setHoveredId(ws.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              padding: isEditing ? '0' : '6px 16px 6px 16px',
              border: 'none',
              borderBottom: isActive ? '2px solid #1a73e8' : '2px solid transparent',
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              background: isActive
                ? '#ffffff'
                : isHovered
                  ? '#e8eaed'
                  : 'transparent',
              fontWeight: isActive ? 600 : 400,
              cursor: isEditing ? 'text' : 'pointer',
              fontSize: 12,
              color: isActive ? '#1a73e8' : '#5f6368',
              transition: 'background 0.15s, color 0.15s',
              userSelect: 'none',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              height: 30,
              boxSizing: 'border-box',
            }}
            title={onRenameWorksheet ? 'Double-click to rename' : undefined}
          >
            {isEditing ? (
              <input
                ref={editInputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={commitRename}
                style={{
                  width: 80,
                  height: 22,
                  border: '1px solid #1a73e8',
                  borderRadius: 2,
                  padding: '0 6px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  outline: 'none',
                  margin: '0 4px',
                  background: '#fff',
                }}
              />
            ) : (
              ws.name
            )}
          </div>
        );
      })}

      {/* Spacer to fill remaining bar */}
      <div style={{ flex: 1 }} />
    </div>
  );
};
