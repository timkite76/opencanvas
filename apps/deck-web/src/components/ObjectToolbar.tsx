import React from 'react';
import type { BaseNode } from '@opencanvas/core-types';

interface ObjectToolbarProps {
  objectId: string;
  node: BaseNode | undefined;
  onDelete: () => void;
}

export const ObjectToolbar: React.FC<ObjectToolbarProps> = ({
  objectId,
  node,
  onDelete,
}) => {
  const anyNode = node as unknown as Record<string, unknown> | undefined;
  const nodeType = anyNode?.type as string ?? 'unknown';
  const x = anyNode?.x as number | undefined;
  const y = anyNode?.y as number | undefined;
  const w = anyNode?.width as number | undefined;
  const h = anyNode?.height as number | undefined;

  return (
    <div
      style={{
        padding: '6px 16px',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontSize: 12,
        background: '#fafafa',
        color: '#555',
      }}
    >
      <span>
        <strong>Selected:</strong> {nodeType}
      </span>
      {x !== undefined && y !== undefined && (
        <span>Position: ({x}, {y})</span>
      )}
      {w !== undefined && h !== undefined && (
        <span>Size: {w} x {h}</span>
      )}
      <button
        onClick={onDelete}
        style={{
          padding: '3px 10px',
          background: '#ea4335',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          fontSize: 11,
          marginLeft: 'auto',
        }}
      >
        Delete
      </button>
    </div>
  );
};
