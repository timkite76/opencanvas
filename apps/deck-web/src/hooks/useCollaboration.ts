import { useState, useEffect, useRef, useCallback } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import {
  CollabProvider,
  initFromArtifact,
  artifactFromYDoc,
  observeYDoc,
  getColorForUser,
  type UserAwareness,
} from '@opencanvas/collab-sdk';

const COLLAB_WS_URL = 'ws://localhost:4002';

export interface CollaborationState {
  isConnected: boolean;
  connectedUsers: UserAwareness[];
  initializeWithArtifact: (artifact: ArtifactEnvelope) => void;
  syncArtifactToYDoc: (artifact: ArtifactEnvelope) => void;
}

export function useCollaboration(
  docId: string,
  userName: string,
  enabled: boolean,
  onRemoteArtifactUpdate: (artifact: ArtifactEnvelope) => void,
): CollaborationState {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<UserAwareness[]>([]);
  const providerRef = useRef<CollabProvider | null>(null);
  const unobserveRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const provider = new CollabProvider(docId, COLLAB_WS_URL);
    providerRef.current = provider;
    initializedRef.current = false;

    const userId = `user-${userName}`;
    provider.setLocalAwareness({
      userId,
      userName,
      color: getColorForUser(userId),
    });

    const connInterval = setInterval(() => {
      setIsConnected(provider.connected);
    }, 1000);

    const awareness = provider.getAwareness();
    const awarenessHandler = () => {
      const states = provider.getAwarenessStates();
      const users: UserAwareness[] = [];
      for (const [, state] of states) {
        users.push(state);
      }
      setConnectedUsers(users);
    };
    awareness.on('change', awarenessHandler);

    const unobserve = observeYDoc(provider.getYDoc(), (artifact) => {
      onRemoteArtifactUpdate(artifact);
    });
    unobserveRef.current = unobserve;

    provider.connect();

    return () => {
      clearInterval(connInterval);
      awareness.off('change', awarenessHandler);
      if (unobserveRef.current) {
        unobserveRef.current();
        unobserveRef.current = null;
      }
      provider.destroy();
      providerRef.current = null;
      initializedRef.current = false;
      setIsConnected(false);
      setConnectedUsers([]);
    };
  }, [enabled, docId, userName, onRemoteArtifactUpdate]);

  const initializeWithArtifact = useCallback(
    (artifact: ArtifactEnvelope) => {
      if (!providerRef.current || initializedRef.current) return;
      const ydoc = providerRef.current.getYDoc();
      const nodesMap = ydoc.getMap('nodes');
      if (nodesMap.size === 0) {
        initFromArtifact(ydoc, artifact);
      }
      initializedRef.current = true;
    },
    [],
  );

  const syncArtifactToYDoc = useCallback(
    (artifact: ArtifactEnvelope) => {
      if (!providerRef.current) return;
      const ydoc = providerRef.current.getYDoc();
      initFromArtifact(ydoc, artifact);
    },
    [],
  );

  return {
    isConnected,
    connectedUsers,
    initializeWithArtifact,
    syncArtifactToYDoc,
  };
}
