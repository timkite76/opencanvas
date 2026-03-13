import React, { useState, useCallback, useMemo } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode } from '@opencanvas/grid-model';
import { importXlsx, exportXlsx } from '@opencanvas/interop-xlsx';
import type { CompatibilityReport } from '@opencanvas/interop-ooxml';
import { createWorkbookService } from './services/workbook-service.js';
import { GridShell } from './components/GridShell.js';
import { CollabBar } from './components/CollabBar.js';
import { useCollaboration } from './hooks/useCollaboration.js';

export const App: React.FC = () => {
  const service = useMemo(() => createWorkbookService(), []);
  const [artifact, setArtifact] = useState<ArtifactEnvelope<GridNode> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [collabEnabled, setCollabEnabled] = useState(false);

  const collabUserName = useMemo(() => `User-${Math.random().toString(36).slice(2, 6)}`, []);
  const collabDocId = useMemo(() => 'grid-shared-doc', []);

  const handleRemoteArtifactUpdate = useCallback((remoteArtifact: ArtifactEnvelope) => {
    setArtifact(remoteArtifact as ArtifactEnvelope<GridNode>);
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
    setStatusMessage('Workbook loaded');
    if (collabEnabled) {
      collab.initializeWithArtifact(loaded);
    }
  }, [service, collabEnabled, collab]);

  const handleSave = useCallback(() => {
    if (!artifact) return;
    service.save(artifact);
    setIsDirty(false);
    setStatusMessage('Workbook saved (see console)');
  }, [artifact, service]);

  const handleArtifactChange = useCallback((next: ArtifactEnvelope<GridNode>) => {
    setArtifact(next);
    setIsDirty(true);
    if (collabEnabled) {
      collab.syncArtifactToYDoc(next);
    }
  }, [collabEnabled, collab]);

  const handleImportXlsx = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const { artifact: imported, report } = await importXlsx(new Uint8Array(arrayBuffer));
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

  const handleExportXlsx = useCallback(async () => {
    if (!artifact) return;
    try {
      const { data, report } = await exportXlsx(artifact);
      const blob = new Blob([data.slice().buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workbook.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      const summary = formatCompatReport(report);
      setStatusMessage(`Exported .xlsx. ${summary}`);
    } catch (err) {
      setStatusMessage(`Export error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [artifact]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
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
        <strong>OpenCanvas Grid</strong>
        <button onClick={handleOpen} style={{ padding: '4px 12px' }}>
          Open Sample
        </button>
        <button onClick={handleSave} disabled={!artifact} style={{ padding: '4px 12px' }}>
          Save
        </button>
        <button onClick={handleImportXlsx} style={{ padding: '4px 12px' }}>
          Import .xlsx
        </button>
        <button onClick={handleExportXlsx} disabled={!artifact} style={{ padding: '4px 12px' }}>
          Export .xlsx
        </button>
        <button
          onClick={() => setCollabEnabled((v) => !v)}
          style={{
            padding: '4px 12px',
            backgroundColor: collabEnabled ? '#4caf50' : undefined,
            color: collabEnabled ? '#fff' : undefined,
            border: collabEnabled ? '1px solid #388e3c' : undefined,
          }}
        >
          {collabEnabled ? 'Collaborating' : 'Collaborate'}
        </button>
        {isDirty && <span style={{ color: '#e67e22' }}>Unsaved changes</span>}
        {statusMessage && <span style={{ color: '#888' }}>{statusMessage}</span>}
      </div>

      {collabEnabled && (
        <CollabBar
          isConnected={collab.isConnected}
          connectedUsers={collab.connectedUsers}
          docId={collabDocId}
        />
      )}

      {/* Main area */}
      {artifact ? (
        <GridShell
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
          Click "Open Sample" to load a workbook
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
