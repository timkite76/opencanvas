import React from 'react';
import type { WorksheetNode } from '@opencanvas/grid-model';

interface WorksheetTabsProps {
  worksheets: WorksheetNode[];
  activeWorksheetId: string | null;
  onSelectWorksheet: (worksheetId: string) => void;
}

export const WorksheetTabs: React.FC<WorksheetTabsProps> = ({
  worksheets,
  activeWorksheetId,
  onSelectWorksheet,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderTop: '1px solid #ddd',
        background: '#f0f0f0',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
      }}
    >
      {worksheets.map((ws) => (
        <button
          key={ws.id}
          onClick={() => onSelectWorksheet(ws.id)}
          style={{
            padding: '6px 16px',
            border: 'none',
            borderRight: '1px solid #ddd',
            background: ws.id === activeWorksheetId ? '#fff' : 'transparent',
            fontWeight: ws.id === activeWorksheetId ? 600 : 400,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {ws.name}
        </button>
      ))}
    </div>
  );
};
