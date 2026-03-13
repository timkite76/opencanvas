import React from 'react';
import type { UserAwareness } from '@opencanvas/collab-sdk';

interface CollabBarProps {
  isConnected: boolean;
  connectedUsers: UserAwareness[];
  docId: string;
}

export const CollabBar: React.FC<CollabBarProps> = ({ isConnected, connectedUsers, docId }) => {
  return (
    <div
      style={{
        padding: '4px 16px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        backgroundColor: '#f8f9fa',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: isConnected ? '#4caf50' : '#f44336',
          }}
        />
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>

      <span style={{ color: '#ccc' }}>|</span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {connectedUsers.map((user, i) => (
          <span
            key={`${user.userId}-${i}`}
            title={user.userName}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: user.color,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {user.userName.charAt(0).toUpperCase()}
          </span>
        ))}
        <span style={{ color: '#666' }}>
          {connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''}
        </span>
      </span>

      <span style={{ color: '#ccc' }}>|</span>

      <span style={{ color: '#888' }}>Doc: {docId}</span>
    </div>
  );
};
