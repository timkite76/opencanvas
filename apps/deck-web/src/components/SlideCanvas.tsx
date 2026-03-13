import React, { useState, useCallback, useRef } from 'react';
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
}

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

interface DragState {
  objectId: string;
  startMouseX: number;
  startMouseY: number;
  startObjX: number;
  startObjY: number;
}

interface ResizeState {
  objectId: string;
  startMouseX: number;
  startMouseY: number;
  startWidth: number;
  startHeight: number;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  objectIds,
  nodes,
  selectedObjectId,
  onObjectSelect,
  onApplyOp,
  artifactId,
}) => {
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getCanvasScale = useCallback(() => {
    if (!canvasRef.current) return 1;
    return canvasRef.current.getBoundingClientRect().width / SLIDE_WIDTH;
  }, []);

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

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, objectId: string) => {
    if (editingObjectId === objectId) return;
    e.preventDefault();
    const node = nodes[objectId] as unknown as Record<string, unknown> | undefined;
    if (!node) return;

    const scale = getCanvasScale();
    setDragState({
      objectId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startObjX: (node.x as number) ?? 0,
      startObjY: (node.y as number) ?? 0,
    });
  }, [editingObjectId, nodes, getCanvasScale]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState) {
      // Visual feedback is handled by the operation on mouseup
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
      const dw = (e.clientX - resizeState.startMouseX) / scale;
      const dh = (e.clientY - resizeState.startMouseY) / scale;
      const newW = Math.round(Math.max(40, resizeState.startWidth + dw));
      const newH = Math.round(Math.max(20, resizeState.startHeight + dh));

      const op: Operation = {
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
      };
      onApplyOp(op);
      setResizeState(null);
    }
  }, [dragState, resizeState, getCanvasScale, artifactId, onApplyOp]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, objectId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes[objectId] as unknown as Record<string, unknown> | undefined;
    if (!node) return;

    setResizeState({
      objectId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
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
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          maxWidth: '100%',
          background: slide.backgroundColor ?? '#ffffff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          position: 'relative',
          aspectRatio: `${SLIDE_WIDTH}/${SLIDE_HEIGHT}`,
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
                  if (e.key === 'Escape') {
                    setEditingObjectId(null);
                    (e.target as HTMLElement).blur();
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

        {/* Resize handle for selected object */}
        {selectedObjectId && !editingObjectId && (() => {
          const node = nodes[selectedObjectId] as unknown as Record<string, unknown> | undefined;
          if (!node) return null;
          const x = (node.x as number) ?? 0;
          const y = (node.y as number) ?? 0;
          const w = (node.width as number) ?? 100;
          const h = (node.height as number) ?? 50;

          return (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, selectedObjectId)}
              style={{
                position: 'absolute',
                left: x + w - 5,
                top: y + h - 5,
                width: 10,
                height: 10,
                background: '#1a73e8',
                cursor: 'se-resize',
                borderRadius: 2,
                zIndex: 10,
              }}
            />
          );
        })()}
      </div>
    </div>
  );
};
