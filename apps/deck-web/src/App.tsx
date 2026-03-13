import React, { useState, useCallback, useMemo } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode } from '@opencanvas/deck-model';
import { importPptx, exportPptx } from '@opencanvas/interop-pptx';
import type { CompatibilityReport } from '@opencanvas/interop-ooxml';
import { createPresentationService } from './services/presentation-service.js';
import { DeckShell } from './components/DeckShell.js';
import { CollabBar } from './components/CollabBar.js';
import { useCollaboration } from './hooks/useCollaboration.js';

const topBarBtnBase: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #dadce0',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'system-ui, sans-serif',
  background: '#ffffff',
  color: '#3c4043',
  transition: 'background 0.15s ease, box-shadow 0.15s ease',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  lineHeight: '1',
};

const topBarBtnPrimary: React.CSSProperties = {
  ...topBarBtnBase,
  background: '#1a73e8',
  color: '#ffffff',
  borderColor: '#1a73e8',
};

export const App: React.FC = () => {
  const service = useMemo(() => createPresentationService(), []);
  const [artifact, setArtifact] = useState<ArtifactEnvelope<DeckNode> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [collabEnabled, setCollabEnabled] = useState(false);

  const collabUserName = useMemo(() => `User-${Math.random().toString(36).slice(2, 6)}`, []);
  const collabDocId = useMemo(() => 'deck-shared-doc', []);

  const handleRemoteArtifactUpdate = useCallback((remoteArtifact: ArtifactEnvelope) => {
    setArtifact(remoteArtifact as ArtifactEnvelope<DeckNode>);
  }, []);

  const collab = useCollaboration(
    collabDocId,
    collabUserName,
    collabEnabled,
    handleRemoteArtifactUpdate,
  );

  const handleOpen = useCallback(() => {
    const loaded = service.open();
    setArtifact(loaded);
    setIsDirty(false);
    setStatusMessage('Presentation loaded');
    if (collabEnabled) {
      collab.initializeWithArtifact(loaded);
    }
  }, [service, collabEnabled, collab]);

  const handleSave = useCallback(() => {
    if (!artifact) return;
    service.save(artifact);
    setIsDirty(false);
    setStatusMessage('Presentation saved (see console)');
  }, [artifact, service]);

  const handleArtifactChange = useCallback((next: ArtifactEnvelope<DeckNode>) => {
    setArtifact(next);
    setIsDirty(true);
    if (collabEnabled) {
      collab.syncArtifactToYDoc(next);
    }
  }, [collabEnabled, collab]);

  const handleImportPptx = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pptx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const { artifact: imported, report } = await importPptx(new Uint8Array(arrayBuffer));
        setArtifact(imported);
        setIsDirty(false);
        const summary = formatCompatReport(report);
        setStatusMessage(`Imported: ${file.name}. ${summary}`);
      } catch (err) {
        setStatusMessage(`Import error: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    };
    input.click();
  }, []);

  const handleExportPptx = useCallback(async () => {
    if (!artifact) return;
    try {
      const { data, report } = await exportPptx(artifact);
      const blob = new Blob([data.slice().buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'presentation.pptx';
      a.click();
      URL.revokeObjectURL(url);
      const summary = formatCompatReport(report);
      setStatusMessage(`Exported .pptx. ${summary}`);
    } catch (err) {
      setStatusMessage(`Export error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [artifact]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top application bar */}
      <div
        style={{
          padding: '8px 20px',
          borderBottom: '1px solid #dadce0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 14,
          background: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          zIndex: 10,
        }}
      >
        {/* App brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginRight: 8,
        }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #1a73e8, #8ab4f8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
          }}>
            D
          </div>
          <span style={{ fontWeight: 600, color: '#202124', fontSize: 15 }}>
            OpenCanvas Deck
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: '#dadce0' }} />

        {/* Action buttons */}
        <button
          onClick={handleOpen}
          style={topBarBtnPrimary}
          onMouseEnter={(e) => e.currentTarget.style.background = '#1557b0'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#1a73e8'}
        >
          Open Sample
        </button>
        <button
          onClick={handleSave}
          disabled={!artifact}
          style={{
            ...topBarBtnBase,
            opacity: artifact ? 1 : 0.4,
            cursor: artifact ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={(e) => { if (artifact) e.currentTarget.style.background = '#f1f3f4'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
        >
          Save
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: '#e8eaed' }} />

        <button
          onClick={handleImportPptx}
          style={topBarBtnBase}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f1f3f4'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
        >
          Import .pptx
        </button>
        <button
          onClick={handleExportPptx}
          disabled={!artifact}
          style={{
            ...topBarBtnBase,
            opacity: artifact ? 1 : 0.4,
            cursor: artifact ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={(e) => { if (artifact) e.currentTarget.style.background = '#f1f3f4'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
        >
          Export .pptx
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: '#e8eaed' }} />

        <button
          onClick={() => setCollabEnabled((v) => !v)}
          style={collabEnabled ? {
            ...topBarBtnBase,
            background: '#188038',
            color: '#ffffff',
            borderColor: '#188038',
          } : topBarBtnBase}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = collabEnabled ? '#137333' : '#f1f3f4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = collabEnabled ? '#188038' : '#ffffff';
          }}
        >
          {collabEnabled ? 'Collaborating' : 'Collaborate'}
        </button>

        {/* Status area - right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {isDirty && (
            <span style={{
              color: '#e37400',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#e37400',
                display: 'inline-block',
              }} />
              Unsaved changes
            </span>
          )}
          {statusMessage && (
            <span style={{ color: '#80868b', fontSize: 12 }}>{statusMessage}</span>
          )}
        </div>
      </div>

      {collabEnabled && (
        <CollabBar
          isConnected={collab.isConnected}
          connectedUsers={collab.connectedUsers}
          docId={collabDocId}
        />
      )}

      {artifact ? (
        <DeckShell
          artifact={artifact}
          service={service}
          onArtifactChange={handleArtifactChange}
          onSave={handleSave}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#5f6368',
            background: '#f8f9fa',
            gap: 16,
          }}
        >
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #e8f0fe, #d2e3fc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            color: '#1a73e8',
            fontWeight: 700,
          }}>
            D
          </div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            Click "Open Sample" to load a presentation
          </div>
          <div style={{ fontSize: 13, color: '#80868b' }}>
            Or import a .pptx file to get started
          </div>
        </div>
      )}
    </div>
  );
};

function formatCompatReport(report: CompatibilityReport): string {
  const parts: string[] = [];
  if (report.preserved.length > 0) {
    parts.push(`Preserved: ${report.preserved.length}`);
  }
  if (report.approximated.length > 0) {
    parts.push(`Approximated: ${report.approximated.join(', ')}`);
  }
  if (report.unsupported.length > 0) {
    parts.push(`Unsupported: ${report.unsupported.join(', ')}`);
  }
  if (report.omitted.length > 0) {
    parts.push(`Omitted: ${report.omitted.join(', ')}`);
  }
  return parts.join(' | ');
}
