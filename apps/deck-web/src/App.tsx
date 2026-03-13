import React, { useState, useCallback, useMemo } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode } from '@opencanvas/deck-model';
import { importPptx, exportPptx } from '@opencanvas/interop-pptx';
import type { CompatibilityReport } from '@opencanvas/interop-ooxml';
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
        <button onClick={handleImportPptx} style={{ padding: '4px 12px' }}>
          Import .pptx
        </button>
        <button onClick={handleExportPptx} disabled={!artifact} style={{ padding: '4px 12px' }}>
          Export .pptx
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
