import React, { useState, useCallback, useMemo } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode } from '@opencanvas/deck-model';
import { importPptx, exportPptx } from '@opencanvas/interop-pptx';
import type { CompatibilityReport } from '@opencanvas/interop-ooxml';
import { createPresentationService } from './services/presentation-service.js';
import { DeckShell } from './components/DeckShell.js';
import { CollabBar } from './components/CollabBar.js';
import { ActionLog } from './components/ActionLog.js';
import { FunctionBrowser } from './components/FunctionBrowser.js';
import { useCollaboration } from './hooks/useCollaboration.js';

const topBarBtnBase: React.CSSProperties = {
  padding: '5px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  background: '#ffffff',
  color: '#374151',
  transition: 'background 0.15s, border-color 0.15s',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  lineHeight: '20px',
  whiteSpace: 'nowrap' as const,
};

const topBarBtnDisabled: React.CSSProperties = {
  ...topBarBtnBase,
  opacity: 0.4,
  cursor: 'default',
};

export const App: React.FC = () => {
  const service = useMemo(() => createPresentationService(), []);
  const [artifact, setArtifact] = useState<ArtifactEnvelope<DeckNode> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentFromFirst, setPresentFromFirst] = useState(false);
  const [showActionLog, setShowActionLog] = useState(false);
  const [showFunctionBrowser, setShowFunctionBrowser] = useState(false);

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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Inter", system-ui, -apple-system, sans-serif' }}>
      {/* Top bar */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #e2e5e9',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          background: '#ffffff',
          flexShrink: 0,
        }}
      >
        {/* App icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            D
          </div>
          <span style={{ fontWeight: 600, color: '#111827', fontSize: 15, whiteSpace: 'nowrap' }}>Deck</span>
        </div>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button onClick={handleOpen} style={topBarBtnBase} onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}>
          New
        </button>
        <button onClick={handleSave} disabled={!artifact} style={artifact ? topBarBtnBase : topBarBtnDisabled} onMouseEnter={(e) => { if (artifact) e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { if (artifact) e.currentTarget.style.background = '#ffffff'; }}>
          Save
        </button>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button onClick={handleImportPptx} style={topBarBtnBase} onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}>
          Import
        </button>
        <button onClick={handleExportPptx} disabled={!artifact} style={artifact ? topBarBtnBase : topBarBtnDisabled} onMouseEnter={(e) => { if (artifact) e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { if (artifact) e.currentTarget.style.background = '#ffffff'; }}>
          Export
        </button>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button
          onClick={() => { setPresentFromFirst(true); setIsPresenting(true); }}
          disabled={!artifact}
          style={artifact ? topBarBtnBase : topBarBtnDisabled}
          onMouseEnter={(e) => { if (artifact) e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (artifact) e.currentTarget.style.background = '#ffffff'; }}
        >
          Present
        </button>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button
          onClick={() => { setShowActionLog((v) => !v); setShowFunctionBrowser(false); }}
          style={showActionLog ? { ...topBarBtnBase, background: '#ede9fe', color: '#7c3aed', borderColor: '#c4b5fd' } : topBarBtnBase}
          onMouseEnter={(e) => { if (!showActionLog) e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (!showActionLog) e.currentTarget.style.background = '#ffffff'; }}
        >
          AI Log
        </button>
        <button
          onClick={() => { setShowFunctionBrowser((v) => !v); setShowActionLog(false); }}
          style={showFunctionBrowser ? { ...topBarBtnBase, background: '#dbeafe', color: '#2563eb', borderColor: '#93c5fd' } : topBarBtnBase}
          onMouseEnter={(e) => { if (!showFunctionBrowser) e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (!showFunctionBrowser) e.currentTarget.style.background = '#ffffff'; }}
        >
          Functions
        </button>

        <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />

        <button
          onClick={() => setCollabEnabled((v) => !v)}
          style={collabEnabled ? { ...topBarBtnBase, background: '#d1fae5', color: '#059669', borderColor: '#6ee7b7' } : topBarBtnBase}
          onMouseEnter={(e) => { if (!collabEnabled) e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (!collabEnabled) e.currentTarget.style.background = '#ffffff'; }}
        >
          {collabEnabled ? 'Collaborating' : 'Collaborate'}
        </button>

        {/* Status area - right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDirty && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', fontSize: 12, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#d97706', display: 'inline-block' }} />
              Unsaved
            </span>
          )}
          {statusMessage && (
            <span style={{ color: '#9ca3af', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statusMessage}</span>
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
          isPresenting={isPresenting}
          presentFromFirst={presentFromFirst}
          onStartPresenting={(fromFirst: boolean) => {
            setPresentFromFirst(fromFirst);
            setIsPresenting(true);
          }}
          onStopPresenting={() => setIsPresenting(false)}
        />
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          color: '#9ca3af',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: '#f5f3ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: '#7c3aed',
          }}>
            🎯
          </div>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#6b7280' }}>No presentation open</span>
          <span style={{ fontSize: 13 }}>Click &quot;New&quot; to create a presentation</span>
        </div>
      )}

      {/* Slide-out panels */}
      <ActionLog isOpen={showActionLog} onClose={() => setShowActionLog(false)} />
      <FunctionBrowser isOpen={showFunctionBrowser} onClose={() => setShowFunctionBrowser(false)} />
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
