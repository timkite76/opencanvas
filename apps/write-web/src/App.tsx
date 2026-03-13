import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import { deserializeArtifact, serializeArtifact } from '@opencanvas/core-format';
import { WriteDocumentAdapter, type CanonicalSelection, type EditableBlock } from '@opencanvas/write-editor';
import { SAMPLE_OCD_FILES } from './sample-data/sample-prd.js';
import { WriteSurface } from './components/WriteSurface.js';
import { AiPanel } from './components/AiPanel.js';

const AI_RUNTIME_URL = 'http://localhost:4001';

interface PendingPreview {
  taskId: string;
  previewText: string;
  operations: Operation[];
}

export const App: React.FC = () => {
  const adapterRef = useRef<WriteDocumentAdapter | null>(null);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [selection, setSelection] = useState<CanonicalSelection | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const refreshBlocks = useCallback(() => {
    if (!adapterRef.current) return;
    setBlocks(adapterRef.current.getEditableBlocks());
  }, []);

  const handleOpen = useCallback(() => {
    const artifact = deserializeArtifact(SAMPLE_OCD_FILES);
    adapterRef.current = new WriteDocumentAdapter(artifact);
    refreshBlocks();
    setIsLoaded(true);
    setIsDirty(false);
    setStatusMessage('Document loaded');
  }, [refreshBlocks]);

  const handleSave = useCallback(() => {
    if (!adapterRef.current) return;
    const serialized = serializeArtifact(adapterRef.current.getArtifact());
    console.log('[save] serialized package:', serialized.files);
    setIsDirty(false);
    setStatusMessage('Document saved (see console)');
  }, []);

  const handleBlockTextChange = useCallback(
    (blockId: string, newText: string) => {
      if (!adapterRef.current) return;

      const artifact = adapterRef.current.getArtifact();
      const node = artifact.nodes[blockId] as { content?: { text: string }[] } | undefined;
      if (!node?.content) return;

      const oldText = node.content.map((r) => r.text).join('');
      if (oldText === newText) return;

      const op: Operation = {
        operationId: uuidv4(),
        type: 'replace_text',
        artifactId: artifact.artifactId,
        targetId: blockId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: {
          startOffset: 0,
          endOffset: oldText.length,
          newText,
          oldText,
        },
      };

      adapterRef.current.applyOperation(op);
      setIsDirty(true);
      // Don't refresh blocks during typing to avoid cursor jump
    },
    [],
  );

  const handleRewrite = useCallback(
    async (tone: string) => {
      if (!adapterRef.current || !selection) return;
      setIsLoading(true);
      setPendingPreview(null);
      setStatusMessage('');

      try {
        const response = await fetch(`${AI_RUNTIME_URL}/ai/tasks/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskType: 'rewrite_block',
            targetId: selection.objectId,
            selectionStart: selection.startOffset,
            selectionEnd: selection.endOffset,
            parameters: { tone },
            artifact: adapterRef.current.getArtifact(),
          }),
        });

        const data = await response.json();
        setPendingPreview({
          taskId: data.taskId,
          previewText: data.previewText,
          operations: data.proposedOperations,
        });
      } catch (err) {
        setStatusMessage(`AI error: ${err instanceof Error ? err.message : 'unknown'}`);
      } finally {
        setIsLoading(false);
      }
    },
    [selection],
  );

  const handleApprove = useCallback(async () => {
    if (!adapterRef.current || !pendingPreview) return;

    try {
      const response = await fetch(
        `${AI_RUNTIME_URL}/ai/tasks/${pendingPreview.taskId}/approve`,
        { method: 'POST' },
      );
      const data = await response.json();

      adapterRef.current.applyOperations(data.approvedOperations);
      refreshBlocks();
      setPendingPreview(null);
      setIsDirty(true);
      setStatusMessage('AI changes applied');
    } catch (err) {
      setStatusMessage(`Approve error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [pendingPreview, refreshBlocks]);

  const handleReject = useCallback(async () => {
    if (!pendingPreview) return;

    try {
      await fetch(`${AI_RUNTIME_URL}/ai/tasks/${pendingPreview.taskId}/reject`, {
        method: 'POST',
      });
      setPendingPreview(null);
      setStatusMessage('AI changes rejected');
    } catch (err) {
      setStatusMessage(`Reject error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [pendingPreview]);

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
        <strong>OpenCanvas Write</strong>
        <button onClick={handleOpen} style={{ padding: '4px 12px' }}>
          Open Sample
        </button>
        <button onClick={handleSave} disabled={!isLoaded} style={{ padding: '4px 12px' }}>
          Save
        </button>
        {isDirty && <span style={{ color: '#e67e22' }}>Unsaved changes</span>}
        {statusMessage && <span style={{ color: '#888' }}>{statusMessage}</span>}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {isLoaded ? (
            <WriteSurface
              blocks={blocks}
              focusedBlockId={focusedBlockId}
              onBlockTextChange={handleBlockTextChange}
              onSelectionChange={setSelection}
              onBlockFocus={setFocusedBlockId}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#888',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Click "Open Sample" to load a document
            </div>
          )}
        </div>

        {isLoaded && (
          <AiPanel
            selection={selection}
            pendingPreview={pendingPreview}
            isLoading={isLoading}
            onRewrite={handleRewrite}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>
    </div>
  );
};
