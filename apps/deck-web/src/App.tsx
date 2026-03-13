import React, { useState, useCallback, useMemo } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode } from '@opencanvas/deck-model';
import { createPresentationService } from './services/presentation-service.js';
import { DeckShell } from './components/DeckShell.js';

export const App: React.FC = () => {
  const service = useMemo(() => createPresentationService(), []);
  const [artifact, setArtifact] = useState<ArtifactEnvelope<DeckNode> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleOpen = useCallback(() => {
    const loaded = service.open();
    setArtifact(loaded);
    setIsDirty(false);
    setStatusMessage('Presentation loaded');
  }, [service]);

  const handleSave = useCallback(() => {
    if (!artifact) return;
    service.save(artifact);
    setIsDirty(false);
    setStatusMessage('Presentation saved (see console)');
  }, [artifact, service]);

  const handleArtifactChange = useCallback((next: ArtifactEnvelope<DeckNode>) => {
    setArtifact(next);
    setIsDirty(true);
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
        }}
      >
        <strong>OpenCanvas Deck</strong>
        <button onClick={handleOpen} style={{ padding: '4px 12px' }}>
          Open Sample
        </button>
        <button onClick={handleSave} disabled={!artifact} style={{ padding: '4px 12px' }}>
          Save
        </button>
        {isDirty && <span style={{ color: '#e67e22' }}>Unsaved changes</span>}
        {statusMessage && <span style={{ color: '#888' }}>{statusMessage}</span>}
      </div>

      {artifact ? (
        <DeckShell
          artifact={artifact}
          service={service}
          onArtifactChange={handleArtifactChange}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Click "Open Sample" to load a presentation
        </div>
      )}
    </div>
  );
};
