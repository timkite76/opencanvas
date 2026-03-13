import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ObjectID, BaseNode, Operation } from '@opencanvas/core-types';
import type { SlideNode } from '@opencanvas/deck-model';

interface SlideCanvasProps {
  slide: SlideNode | undefined;
  objectIds: ObjectID[];
  nodes: Record<ObjectID, BaseNode>;
  selectedObjectId: string | null;
  onObjectSelect: (objectId: string | null) => void;
  onApplyOp: (op: Operation) => void;
  artifactId: string;
  onDeleteObject?: () => void;
  onDuplicateObject?: () => void;
}

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DragState {
  objectId: string;
  startMouseX: number;
  startMouseY: number;
  startObjX: number;
  startObjY: number;
}

interface ResizeState {
  objectId: string;
  handle: ResizeHandle;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

const HANDLE_SIZE = 8;
const HALF_HANDLE = HANDLE_SIZE / 2;

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize',
  n: 'n-resize',
  ne: 'ne-resize',
  e: 'e-resize',
  se: 'se-resize',
  s: 's-resize',
  sw: 'sw-resize',
  w: 'w-resize',
};

function getHandlePositions(x: number, y: number, w: number, h: number): Record<ResizeHandle, { left: number; top: number }> {
  return {
    nw: { left: x - HALF_HANDLE, top: y - HALF_HANDLE },
    n:  { left: x + w / 2 - HALF_HANDLE, top: y - HALF_HANDLE },
    ne: { left: x + w - HALF_HANDLE, top: y - HALF_HANDLE },
    e:  { left: x + w - HALF_HANDLE, top: y + h / 2 - HALF_HANDLE },
    se: { left: x + w - HALF_HANDLE, top: y + h - HALF_HANDLE },
    s:  { left: x + w / 2 - HALF_HANDLE, top: y + h - HALF_HANDLE },
    sw: { left: x - HALF_HANDLE, top: y + h - HALF_HANDLE },
    w:  { left: x - HALF_HANDLE, top: y + h / 2 - HALF_HANDLE },
  };
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  objectIds,
  nodes,
  selectedObjectId,
  onObjectSelect,
  onApplyOp,
  artifactId,
  onDeleteObject,
  onDuplicateObject,
}) => {
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getCanvasScale = useCallback(() => {
    if (!canvasRef.current) return 1;
    return canvasRef.current.getBoundingClientRect().width / SLIDE_WIDTH;
  }, []);

  // Focus the canvas when a slide is loaded or selection changes
  useEffect(() => {
    if (slide && !editingObjectId) {
      canvasRef.current?.focus();
    }
  }, [slide, selectedObjectId, editingObjectId]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onObjectSelect(null);
      setEditingObjectId(null);
    }
  }, [onObjectSelect]);

  const handleObjectClick = useCallback((e: React.MouseEvent, objectId: string) => {
    e.stopPropagation();
    onObjectSelect(objectId);
  }, [onObjectSelect]);

  const handleObjectDoubleClick = useCallback((e: React.MouseEvent, objectId: string) => {
    e.stopPropagation();
    const node = nodes[objectId] as unknown as Record<string, unknown> | undefined;
    if (node?.type === 'textbox') {
      setEditingObjectId(objectId);
    }
  }, [nodes]);

  const handleTextBlur = useCallback((objectId: string, newText: string) => {
    setEditingObjectId(null);

    const node = nodes[objectId] as unknown as Record<string, unknown> | undefined;
    if (!node) return;

    const content = node.content as Array<{ text: string }> | undefined;
    const originalText = content?.map((r) => r.text).join('') ?? '';

    if (newText === originalText) return;

    const op: Operation = {
      operationId: uuidv4(),
      type: 'replace_text',
      artifactId,
      targetId: objectId,
      actorType: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        startOffset: 0,
        endOffset: originalText.length,
        newText,
        oldText: originalText,
      },
    };
    onApplyOp(op);
  }, [nodes, artifactId, onApplyOp]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't handle shortcuts while editing text
    if (editingObjectId) {
      if (e.key === 'Escape') {
        setEditingObjectId(null);
        canvasRef.current?.focus();
      }
      return;
    }

    const isMeta = e.metaKey || e.ctrlKey;

    // Escape - deselect
    if (e.key === 'Escape') {
      onObjectSelect(null);
      return;
    }

    // Delete / Backspace - delete selected object
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
      e.preventDefault();
      onDeleteObject?.();
      return;
    }

    // Ctrl/Cmd+D - duplicate
    if (isMeta && e.key === 'd') {
      e.preventDefault();
      onDuplicateObject?.();
      return;
    }

    // Ctrl/Cmd+A - select all (future multi-select placeholder)
    if (isMeta && e.key === 'a') {
      e.preventDefault();
      // For now, just prevent default browser select-all
      return;
    }

    // Arrow keys - nudge selected object
    if (selectedObjectId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const node = nodes[selectedObjectId] as unknown as Record<string, unknown> | undefined;
      if (!node) return;

      const step = e.shiftKey ? 10 : 1;
      const currentX = (node.x as number) ?? 0;
      const currentY = (node.y as number) ?? 0;
      let newX = currentX;
      let newY = currentY;

      switch (e.key) {
        case 'ArrowUp':    newY = Math.max(0, currentY - step); break;
        case 'ArrowDown':  newY = Math.min(SLIDE_HEIGHT, currentY + step); break;
        case 'ArrowLeft':  newX = Math.max(0, currentX - step); break;
        case 'ArrowRight': newX = Math.min(SLIDE_WIDTH, currentX + step); break;
      }

      if (newX !== currentX || newY !== currentY) {
        const op: Operation = {
          operationId: uuidv4(),
          type: 'move_object',
          artifactId,
          targetId: selectedObjectId,
          actorType: 'user',
          timestamp: new Date().toISOString(),
          payload: {
            x: newX,
            y: newY,
            previousX: currentX,
            previousY: currentY,
          },
        };
        onApplyOp(op);
      }
      return;
    }
  }, [editingObjectId, selectedObjectId, nodes, artifactId, onApplyOp, onObjectSelect, onDeleteObject, onDuplicateObject]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, objectId: string) => {
    if (editingObjectId === objectId) return;
    e.preventDefault();
    const node = nodes[objectId] as unknown as Record<string, unknown> | undefined;
    if (!node) return;

    setDragState({
      objectId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startObjX: (node.x as number) ?? 0,
      startObjY: (node.y as number) ?? 0,
    });
  }, [editingObjectId, nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState) {
      return;
    }
  }, [dragState]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragState) {
      const scale = getCanvasScale();
      const dx = (e.clientX - dragState.startMouseX) / scale;
      const dy = (e.clientY - dragState.startMouseY) / scale;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        const newX = Math.round(Math.max(0, Math.min(SLIDE_WIDTH, dragState.startObjX + dx)));
        const newY = Math.round(Math.max(0, Math.min(SLIDE_HEIGHT, dragState.startObjY + dy)));

        const op: Operation = {
          operationId: uuidv4(),
          type: 'move_object',
          artifactId,
          targetId: dragState.objectId,
          actorType: 'user',
          timestamp: new Date().toISOString(),
          payload: {
            x: newX,
            y: newY,
            previousX: dragState.startObjX,
            previousY: dragState.startObjY,
          },
        };
        onApplyOp(op);
      }
      setDragState(null);
    }

    if (resizeState) {
      const scale = getCanvasScale();
      const dx = (e.clientX - resizeState.startMouseX) / scale;
      const dy = (e.clientY - resizeState.startMouseY) / scale;
      const handle = resizeState.handle;

      let newX = resizeState.startX;
      let newY = resizeState.startY;
      let newW = resizeState.startWidth;
      let newH = resizeState.startHeight;

      // Horizontal adjustments
      if (handle === 'nw' || handle === 'w' || handle === 'sw') {
        newX = Math.round(Math.max(0, resizeState.startX + dx));
        newW = Math.round(Math.max(40, resizeState.startWidth - dx));
      }
      if (handle === 'ne' || handle === 'e' || handle === 'se') {
        newW = Math.round(Math.max(40, resizeState.startWidth + dx));
      }

      // Vertical adjustments
      if (handle === 'nw' || handle === 'n' || handle === 'ne') {
        newY = Math.round(Math.max(0, resizeState.startY + dy));
        newH = Math.round(Math.max(20, resizeState.startHeight - dy));
      }
      if (handle === 'sw' || handle === 's' || handle === 'se') {
        newH = Math.round(Math.max(20, resizeState.startHeight + dy));
      }

      // Build operations: move + resize if position changed, otherwise just resize
      const ops: Operation[] = [];

      if (newX !== resizeState.startX || newY !== resizeState.startY) {
        ops.push({
          operationId: uuidv4(),
          type: 'move_object',
          artifactId,
          targetId: resizeState.objectId,
          actorType: 'user',
          timestamp: new Date().toISOString(),
          payload: {
            x: newX,
            y: newY,
            previousX: resizeState.startX,
            previousY: resizeState.startY,
          },
        });
      }

      ops.push({
        operationId: uuidv4(),
        type: 'resize_object',
        artifactId,
        targetId: resizeState.objectId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
        payload: {
          width: newW,
          height: newH,
          previousWidth: resizeState.startWidth,
          previousHeight: resizeState.startHeight,
        },
      });

      // Apply operations
      for (const op of ops) {
        onApplyOp(op);
      }

      setResizeState(null);
    }
  }, [dragState, resizeState, getCanvasScale, artifactId, onApplyOp]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, objectId: string, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes[objectId] as unknown as Record<string, unknown> | undefined;
    if (!node) return;

    setResizeState({
      objectId,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: (node.x as number) ?? 0,
      startY: (node.y as number) ?? 0,
      startWidth: (node.width as number) ?? 100,
      startHeight: (node.height as number) ?? 50,
    });
  }, [nodes]);

  if (!slide) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        No slide selected
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e0e0e0',
        padding: 24,
        overflow: 'auto',
      }}
    >
      <div
        ref={canvasRef}
        tabIndex={0}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onKeyDown={handleKeyDown}
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          maxWidth: '100%',
          background: slide.backgroundColor ?? '#ffffff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          position: 'relative',
          aspectRatio: `${SLIDE_WIDTH}/${SLIDE_HEIGHT}`,
          outline: 'none',
        }}
      >
        {objectIds.map((objId) => {
          const node = nodes[objId] as unknown as Record<string, unknown> | undefined;
          if (!node) return null;

          const x = (node.x as number) ?? 0;
          const y = (node.y as number) ?? 0;
          const w = (node.width as number) ?? 100;
          const h = (node.height as number) ?? 50;
          const isSelected = objId === selectedObjectId;
          const isEditing = objId === editingObjectId;

          const content = node.content as Array<{ text: string; bold?: boolean; fontSize?: number }> | undefined;
          const text = content?.map((r) => r.text).join('') ?? '';
          const isBold = content?.[0]?.bold ?? false;
          const fontSize = content?.[0]?.fontSize ?? 16;

          if (node.type === 'textbox') {
            return (
              <div
                key={objId}
                onClick={(e) => handleObjectClick(e, objId)}
                onDoubleClick={(e) => handleObjectDoubleClick(e, objId)}
                onMouseDown={(e) => handleMouseDown(e, objId)}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  border: isSelected ? '2px solid #1a73e8' : '1px solid transparent',
                  cursor: isEditing ? 'text' : 'move',
                  boxSizing: 'border-box',
                  padding: 4,
                  fontSize,
                  fontWeight: isBold ? 700 : 400,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  outline: 'none',
                  background: isSelected ? 'rgba(26, 115, 232, 0.04)' : 'transparent',
                }}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={(e) => {
                  if (isEditing) {
                    handleTextBlur(objId, e.currentTarget.textContent ?? '');
                  }
                }}
                onKeyDown={(e) => {
                  if (isEditing && e.key === 'Escape') {
                    setEditingObjectId(null);
                    (e.target as HTMLElement).blur();
                    canvasRef.current?.focus();
                  }
                }}
              >
                {text}
              </div>
            );
          }

          if (node.type === 'shape') {
            const shapeType = node.shapeType as string;
            return (
              <div
                key={objId}
                onClick={(e) => handleObjectClick(e, objId)}
                onMouseDown={(e) => handleMouseDown(e, objId)}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  background: (node.fill as string) ?? '#ddd',
                  borderRadius: shapeType === 'ellipse' ? '50%' : shapeType === 'rounded_rect' ? 8 : 0,
                  border: isSelected
                    ? '2px solid #1a73e8'
                    : node.stroke
                      ? `1px solid ${node.stroke}`
                      : '1px solid transparent',
                  cursor: 'move',
                  boxSizing: 'border-box',
                }}
              />
            );
          }

          if (node.type === 'image_object') {
            return (
              <div
                key={objId}
                onClick={(e) => handleObjectClick(e, objId)}
                onMouseDown={(e) => handleMouseDown(e, objId)}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  background: '#f0f0f0',
                  border: isSelected ? '2px solid #1a73e8' : '1px solid #ccc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: '#888',
                  cursor: 'move',
                  boxSizing: 'border-box',
                }}
              >
                {(node.alt as string) ?? 'Image'}
              </div>
            );
          }

          return null;
        })}

        {/* 8-way resize handles for selected object */}
        {selectedObjectId && !editingObjectId && (() => {
          const node = nodes[selectedObjectId] as unknown as Record<string, unknown> | undefined;
          if (!node) return null;
          const x = (node.x as number) ?? 0;
          const y = (node.y as number) ?? 0;
          const w = (node.width as number) ?? 100;
          const h = (node.height as number) ?? 50;

          const handles = getHandlePositions(x, y, w, h);

          return (Object.entries(handles) as Array<[ResizeHandle, { left: number; top: number }]>).map(([handle, pos]) => (
            <div
              key={handle}
              onMouseDown={(e) => handleResizeMouseDown(e, selectedObjectId, handle)}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: '#1a73e8',
                border: '1px solid #fff',
                cursor: HANDLE_CURSORS[handle],
                zIndex: 10,
                boxSizing: 'border-box',
              }}
            />
          ));
        })()}
      </div>
    </div>
  );
};
