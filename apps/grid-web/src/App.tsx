import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode } from '@opencanvas/grid-model';
import { importXlsx, exportXlsx } from '@opencanvas/interop-xlsx';
import type { CompatibilityReport } from '@opencanvas/interop-ooxml';
import { createWorkbookService } from './services/workbook-service.js';
import { GridShell } from './components/GridShell.js';
import { CollabBar } from './components/CollabBar.js';
import { ActionLog } from './components/ActionLog.js';
import { FunctionBrowser } from './components/FunctionBrowser.js';
import { useCollaboration } from './hooks/useCollaboration.js';

const MAX_UNDO_STACK = 50;

/** Shared button base style */
const toolbarBtnBase: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#ffffff',
  color: '#374151',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  transition: 'background 0.15s, border-color 0.15s',
  whiteSpace: 'nowrap' as const,
  lineHeight: '20px',
};

const ToolbarButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  active?: boolean;
}> = ({ onClick, disabled, title, children, active }) => {
  const [hovered, setHovered] = useState(false);
  const isDisabled = disabled ?? false;

  const style: React.CSSProperties = {
    ...toolbarBtnBase,
    background: active
      ? '#ede9fe'
      : hovered && !isDisabled
        ? '#f3f4f6'
        : '#ffffff',
    color: isDisabled ? '#9ca3af' : active ? '#7c3aed' : '#374151',
    cursor: isDisabled ? 'default' : 'pointer',
    borderColor: active ? '#c4b5fd' : '#d1d5db',
    opacity: isDisabled ? 0.4 : 1,
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
};

const ToolbarSep: React.FC = () => (
  <div style={{ width: 1, height: 20, background: '#e2e5e9', flexShrink: 0 }} />
);

export const App: React.FC = () => {
  const service = useMemo(() => createWorkbookService(), []);
  const [artifact, setArtifact] = useState<ArtifactEnvelope<GridNode> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [showActionLog, setShowActionLog] = useState(false);
  const [showFunctionBrowser, setShowFunctionBrowser] = useState(false);

  // Undo/redo stacks using refs to avoid stale closures
  const undoStackRef = useRef<ArtifactEnvelope<GridNode>[]>([]);
  const redoStackRef = useRef<ArtifactEnvelope<GridNode>[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

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
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoCount(0);
    setRedoCount(0);
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
    setArtifact((prev) => {
      if (prev) {
        undoStackRef.current = [
          ...undoStackRef.current.slice(-(MAX_UNDO_STACK - 1)),
          prev,
        ];
        setUndoCount(undoStackRef.current.length);
      }
      redoStackRef.current = [];
      setRedoCount(0);
      return next;
    });
    setIsDirty(true);
    if (collabEnabled) {
      collab.syncArtifactToYDoc(next);
    }
  }, [collabEnabled, collab]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    setArtifact((current) => {
      if (!current) return current;
      const prev = undoStackRef.current[undoStackRef.current.length - 1]!;
      undoStackRef.current = undoStackRef.current.slice(0, -1);
      redoStackRef.current = [...redoStackRef.current, current];
      setUndoCount(undoStackRef.current.length);
      setRedoCount(redoStackRef.current.length);
      return prev;
    });
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    setArtifact((current) => {
      if (!current) return current;
      const next = redoStackRef.current[redoStackRef.current.length - 1]!;
      redoStackRef.current = redoStackRef.current.slice(0, -1);
      undoStackRef.current = [...undoStackRef.current, current];
      setUndoCount(undoStackRef.current.length);
      setRedoCount(redoStackRef.current.length);
      return next;
    });
  }, []);

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
        undoStackRef.current = [];
        redoStackRef.current = [];
        setUndoCount(0);
        setRedoCount(0);
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: '"Inter", system-ui, -apple-system, sans-serif' }}>
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
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            G
          </div>
          <span style={{ fontWeight: 600, color: '#111827', fontSize: 15, whiteSpace: 'nowrap' }}>Grid</span>
        </div>

        <ToolbarSep />

        <ToolbarButton onClick={handleOpen} title="New workbook">New</ToolbarButton>
        <ToolbarButton onClick={handleSave} disabled={!artifact} title="Save (Ctrl+S)">Save</ToolbarButton>

        <ToolbarSep />

        <ToolbarButton onClick={handleImportXlsx} title="Import an .xlsx file">Import</ToolbarButton>
        <ToolbarButton onClick={handleExportXlsx} disabled={!artifact} title="Export as .xlsx">Export</ToolbarButton>

        <ToolbarSep />

        <ToolbarButton onClick={handleUndo} disabled={!artifact || undoCount === 0} title="Undo (Ctrl+Z)">Undo</ToolbarButton>
        <ToolbarButton onClick={handleRedo} disabled={!artifact || redoCount === 0} title="Redo (Ctrl+Shift+Z)">Redo</ToolbarButton>

        <ToolbarSep />

        <button
          onClick={() => { setShowActionLog((v) => !v); setShowFunctionBrowser(false); }}
          style={showActionLog ? { ...toolbarBtnBase, background: '#ede9fe', color: '#7c3aed', borderColor: '#c4b5fd' } : toolbarBtnBase}
          onMouseEnter={(e) => { if (!showActionLog) e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (!showActionLog) e.currentTarget.style.background = '#ffffff'; }}
        >
          AI Log
        </button>
        <button
          onClick={() => { setShowFunctionBrowser((v) => !v); setShowActionLog(false); }}
          style={showFunctionBrowser ? { ...toolbarBtnBase, background: '#dbeafe', color: '#2563eb', borderColor: '#93c5fd' } : toolbarBtnBase}
          onMouseEnter={(e) => { if (!showFunctionBrowser) e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { if (!showFunctionBrowser) e.currentTarget.style.background = '#ffffff'; }}
        >
          Functions
        </button>

        <ToolbarSep />

        <button
          onClick={() => setCollabEnabled((v) => !v)}
          style={collabEnabled ? { ...toolbarBtnBase, background: '#d1fae5', color: '#059669', borderColor: '#6ee7b7' } : toolbarBtnBase}
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

      {/* Main area */}
      {artifact ? (
        <GridShell
          artifact={artifact}
          service={service}
          onArtifactChange={handleArtifactChange}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
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
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          background: '#ffffff',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: '#16a34a',
          }}>
            📊
          </div>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#6b7280' }}>No workbook open</span>
          <span style={{ fontSize: 13 }}>Click &quot;New&quot; to create a workbook, or import an .xlsx file</span>
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
