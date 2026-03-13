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
  fontFamily: 'inherit',
  border: '1px solid transparent',
  borderRadius: 6,
  background: 'transparent',
  color: '#374151',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 30,
  transition: 'background 0.15s, border-color 0.15s',
  whiteSpace: 'nowrap' as const,
};

const toolbarBtnHoverBg = '#f3f4f6';

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
      ? '#dcfce7'
      : hovered && !isDisabled
        ? toolbarBtnHoverBg
        : 'transparent',
    color: isDisabled ? '#bdc1c6' : active ? '#166534' : '#374151',
    cursor: isDisabled ? 'default' : 'pointer',
    border: active ? '1px solid #bbf7d0' : '1px solid transparent',
    opacity: isDisabled ? 0.7 : 1,
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
      {/* Title bar */}
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          fontSize: 13,
          background: '#ffffff',
          borderBottom: '1px solid #e2e5e9',
        }}
      >
        {/* App icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            G
          </div>
          <span style={{ fontWeight: 500, color: '#202124', fontSize: 15 }}>
            Grid
          </span>
        </div>

        {isDirty && (
          <span style={{ color: '#d97706', fontSize: 11, fontWeight: 500, marginLeft: 4 }}>
            Unsaved
          </span>
        )}

        <div style={{ flex: 1 }} />

        {statusMessage && (
          <span
            style={{
              color: '#9ca3af',
              fontSize: 11,
              maxWidth: 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {statusMessage}
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div
        style={{
          padding: '4px 16px',
          borderBottom: '1px solid #e2e5e9',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          fontSize: 13,
          background: '#ffffff',
          flexWrap: 'wrap' as const,
        }}
      >
        <ToolbarButton onClick={handleOpen} title="New workbook">
          New
        </ToolbarButton>
        <ToolbarButton onClick={handleSave} disabled={!artifact} title="Save (Ctrl+S)">
          Save
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton onClick={handleImportXlsx} title="Import an .xlsx file">
          Import .xlsx
        </ToolbarButton>
        <ToolbarButton onClick={handleExportXlsx} disabled={!artifact} title="Export as .xlsx">
          Export .xlsx
        </ToolbarButton>

        <ToolbarSep />

        {/* Undo with arrow icon */}
        <ToolbarButton
          onClick={handleUndo}
          disabled={!artifact || undoCount === 0}
          title="Undo (Ctrl+Z)"
        >
          <span style={{ fontSize: 16, lineHeight: '16px', fontFamily: 'inherit' }}>{'\u21A9'}</span>
          Undo
        </ToolbarButton>

        {/* Redo with arrow icon */}
        <ToolbarButton
          onClick={handleRedo}
          disabled={!artifact || redoCount === 0}
          title="Redo (Ctrl+Shift+Z)"
        >
          <span style={{ fontSize: 16, lineHeight: '16px', fontFamily: 'inherit' }}>{'\u21AA'}</span>
          Redo
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          onClick={() => { setShowActionLog((v) => !v); setShowFunctionBrowser(false); }}
          active={showActionLog}
          title="View AI action log"
        >
          AI Log
        </ToolbarButton>
        <ToolbarButton
          onClick={() => { setShowFunctionBrowser((v) => !v); setShowActionLog(false); }}
          active={showFunctionBrowser}
          title="Browse AI functions"
        >
          Functions
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          onClick={() => setCollabEnabled((v) => !v)}
          active={collabEnabled}
          title={collabEnabled ? 'Collaboration enabled' : 'Enable collaboration'}
        >
          <span style={{ fontSize: 14 }}>{'\u{1F465}'}</span>
          {collabEnabled ? 'Collaborating' : 'Collaborate'}
        </ToolbarButton>
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
