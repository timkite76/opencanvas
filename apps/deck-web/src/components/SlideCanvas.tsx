import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
const SNAP_THRESHOLD = 5;

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

interface GuideLine {
  orientation: 'horizontal' | 'vertical';
  position: number; // x for vertical, y for horizontal
}

const HANDLE_SIZE = 10;
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

function createGridDotsBackground(): string {
  const spacing = 20;
  const dotRadius = 0.8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${spacing}" height="${spacing}">
    <circle cx="${spacing / 2}" cy="${spacing / 2}" r="${dotRadius}" fill="rgba(0,0,0,0.12)"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const GRID_DOTS_BG = createGridDotsBackground();

/** Compute snap targets from other objects and canvas center */
function computeSnapTargets(
  objectIds: ObjectID[],
  nodes: Record<ObjectID, BaseNode>,
  dragObjectId: string,
): { xTargets: number[]; yTargets: number[] } {
  const xTargets: number[] = [0, SLIDE_WIDTH / 2, SLIDE_WIDTH];
  const yTargets: number[] = [0, SLIDE_HEIGHT / 2, SLIDE_HEIGHT];

  for (const objId of objectIds) {
    if (objId === dragObjectId) continue;
    const n = nodes[objId] as unknown as Record<string, unknown> | undefined;
    if (!n) continue;
    const ox = (n.x as number) ?? 0;
    const oy = (n.y as number) ?? 0;
    const ow = (n.width as number) ?? 0;
    const oh = (n.height as number) ?? 0;
    // edges and center
    xTargets.push(ox, ox + ow / 2, ox + ow);
    yTargets.push(oy, oy + oh / 2, oy + oh);
  }
  return { xTargets, yTargets };
}

/** Given a dragged object rect, find matching guides and snapped position */
function snapAndGuide(
  objX: number, objY: number, objW: number, objH: number,
  xTargets: number[], yTargets: number[],
): { snappedX: number; snappedY: number; guides: GuideLine[] } {
  const guides: GuideLine[] = [];
  let snappedX = objX;
  let snappedY = objY;

  // Object edge/center x positions
  const objXPoints = [objX, objX + objW / 2, objX + objW];
  const objYPoints = [objY, objY + objH / 2, objY + objH];

  let bestDx = SNAP_THRESHOLD + 1;
  let bestDy = SNAP_THRESHOLD + 1;

  for (const tx of xTargets) {
    for (const px of objXPoints) {
      const d = Math.abs(px - tx);
      if (d < bestDx) {
        bestDx = d;
        snappedX = objX + (tx - px);
      }
    }
  }

  for (const ty of yTargets) {
    for (const py of objYPoints) {
      const d = Math.abs(py - ty);
      if (d < bestDy) {
        bestDy = d;
        snappedY = objY + (ty - py);
      }
    }
  }

  // Only apply snap if within threshold
  if (bestDx > SNAP_THRESHOLD) snappedX = objX;
  if (bestDy > SNAP_THRESHOLD) snappedY = objY;

  // Build guide lines for snapped axes
  if (bestDx <= SNAP_THRESHOLD) {
    const snappedXPoints = [snappedX, snappedX + objW / 2, snappedX + objW];
    for (const tx of xTargets) {
      for (const px of snappedXPoints) {
        if (Math.abs(px - tx) < 1) {
          guides.push({ orientation: 'vertical', position: tx });
        }
      }
    }
  }
  if (bestDy <= SNAP_THRESHOLD) {
    const snappedYPoints = [snappedY, snappedY + objH / 2, snappedY + objH];
    for (const ty of yTargets) {
      for (const py of snappedYPoints) {
        if (Math.abs(py - ty) < 1) {
          guides.push({ orientation: 'horizontal', position: ty });
        }
      }
    }
  }

  return { snappedX, snappedY, guides };
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
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [liveDragPos, setLiveDragPos] = useState<{ x: number; y: number } | null>(null);
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getCanvasScale = useCallback(() => {
    if (!canvasRef.current) return 1;
    return canvasRef.current.getBoundingClientRect().width / SLIDE_WIDTH;
  }, []);

  // Precompute snap targets when drag starts
  const snapTargets = useMemo(() => {
    if (!dragState) return null;
    return computeSnapTargets(objectIds, nodes, dragState.objectId);
  }, [dragState, objectIds, nodes]);

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
      payload: { startOffset: 0, endOffset: originalText.length, newText, oldText: originalText },
    };
    onApplyOp(op);
  }, [nodes, artifactId, onApplyOp]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingObjectId) {
      if (e.key === 'Escape') {
        setEditingObjectId(null);
        canvasRef.current?.focus();
      }
      return;
    }
    const isMeta = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') { onObjectSelect(null); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) { e.preventDefault(); onDeleteObject?.(); return; }
    if (isMeta && e.key === 'd') { e.preventDefault(); onDuplicateObject?.(); return; }
    if (isMeta && e.key === 'a') { e.preventDefault(); return; }
    if (selectedObjectId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const node = nodes[selectedObjectId] as unknown as Record<string, unknown> | undefined;
      if (!node) return;
      const step = e.shiftKey ? 10 : 1;
      const currentX = (node.x as number) ?? 0;
      const currentY = (node.y as number) ?? 0;
      let newX = currentX, newY = currentY;
      switch (e.key) {
        case 'ArrowUp':    newY = Math.max(0, currentY - step); break;
        case 'ArrowDown':  newY = Math.min(SLIDE_HEIGHT, currentY + step); break;
        case 'ArrowLeft':  newX = Math.max(0, currentX - step); break;
        case 'ArrowRight': newX = Math.min(SLIDE_WIDTH, currentX + step); break;
      }
      if (newX !== currentX || newY !== currentY) {
        const op: Operation = {
          operationId: uuidv4(), type: 'move_object', artifactId, targetId: selectedObjectId,
          actorType: 'user', timestamp: new Date().toISOString(),
          payload: { x: newX, y: newY, previousX: currentX, previousY: currentY },
        };
        onApplyOp(op);
      }
    }
  }, [editingObjectId, selectedObjectId, nodes, artifactId, onApplyOp, onObjectSelect, onDeleteObject, onDuplicateObject]);

  const handleMouseDown = useCallback((e: React.MouseEvent, objectId: string) => {
    if (editingObjectId === objectId) return;
    e.preventDefault();
    const node = nodes[objectId] as unknown as Record<string, unknown> | undefined;
    if (!node) return;
    setDragState({
      objectId, startMouseX: e.clientX, startMouseY: e.clientY,
      startObjX: (node.x as number) ?? 0, startObjY: (node.y as number) ?? 0,
    });
    setLiveDragPos(null);
    setActiveGuides([]);
  }, [editingObjectId, nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState && snapTargets) {
      const scale = getCanvasScale();
      const dx = (e.clientX - dragState.startMouseX) / scale;
      const dy = (e.clientY - dragState.startMouseY) / scale;
      const rawX = dragState.startObjX + dx;
      const rawY = dragState.startObjY + dy;

      const node = nodes[dragState.objectId] as unknown as Record<string, unknown> | undefined;
      const objW = (node?.width as number) ?? 100;
      const objH = (node?.height as number) ?? 50;

      const { snappedX, snappedY, guides } = snapAndGuide(
        rawX, rawY, objW, objH, snapTargets.xTargets, snapTargets.yTargets,
      );
      setLiveDragPos({ x: snappedX, y: snappedY });
      setActiveGuides(guides);
    }
  }, [dragState, snapTargets, getCanvasScale, nodes]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragState) {
      const scale = getCanvasScale();
      const dx = (e.clientX - dragState.startMouseX) / scale;
      const dy = (e.clientY - dragState.startMouseY) / scale;

      let finalX = dragState.startObjX + dx;
      let finalY = dragState.startObjY + dy;

      // Apply snapping on drop too
      if (snapTargets) {
        const node = nodes[dragState.objectId] as unknown as Record<string, unknown> | undefined;
        const objW = (node?.width as number) ?? 100;
        const objH = (node?.height as number) ?? 50;
        const result = snapAndGuide(finalX, finalY, objW, objH, snapTargets.xTargets, snapTargets.yTargets);
        finalX = result.snappedX;
        finalY = result.snappedY;
      }

      finalX = Math.round(Math.max(0, Math.min(SLIDE_WIDTH, finalX)));
      finalY = Math.round(Math.max(0, Math.min(SLIDE_HEIGHT, finalY)));

      if (Math.abs(finalX - dragState.startObjX) > 2 || Math.abs(finalY - dragState.startObjY) > 2) {
        const op: Operation = {
          operationId: uuidv4(), type: 'move_object', artifactId, targetId: dragState.objectId,
          actorType: 'user', timestamp: new Date().toISOString(),
          payload: { x: finalX, y: finalY, previousX: dragState.startObjX, previousY: dragState.startObjY },
        };
        onApplyOp(op);
      }
      setDragState(null);
      setLiveDragPos(null);
      setActiveGuides([]);
    }

    if (resizeState) {
      const scale = getCanvasScale();
      const dx = (e.clientX - resizeState.startMouseX) / scale;
      const dy = (e.clientY - resizeState.startMouseY) / scale;
      const handle = resizeState.handle;
      let newX = resizeState.startX, newY = resizeState.startY;
      let newW = resizeState.startWidth, newH = resizeState.startHeight;
      if (handle === 'nw' || handle === 'w' || handle === 'sw') {
        newX = Math.round(Math.max(0, resizeState.startX + dx));
        newW = Math.round(Math.max(40, resizeState.startWidth - dx));
      }
      if (handle === 'ne' || handle === 'e' || handle === 'se') {
        newW = Math.round(Math.max(40, resizeState.startWidth + dx));
      }
      if (handle === 'nw' || handle === 'n' || handle === 'ne') {
        newY = Math.round(Math.max(0, resizeState.startY + dy));
        newH = Math.round(Math.max(20, resizeState.startHeight - dy));
      }
      if (handle === 'sw' || handle === 's' || handle === 'se') {
        newH = Math.round(Math.max(20, resizeState.startHeight + dy));
      }
      const ops: Operation[] = [];
      if (newX !== resizeState.startX || newY !== resizeState.startY) {
        ops.push({
          operationId: uuidv4(), type: 'move_object', artifactId, targetId: resizeState.objectId,
          actorType: 'user', timestamp: new Date().toISOString(),
          payload: { x: newX, y: newY, previousX: resizeState.startX, previousY: resizeState.startY },
        });
      }
      ops.push({
        operationId: uuidv4(), type: 'resize_object', artifactId, targetId: resizeState.objectId,
        actorType: 'user', timestamp: new Date().toISOString(),
        payload: { width: newW, height: newH, previousWidth: resizeState.startWidth, previousHeight: resizeState.startHeight },
      });
      for (const op of ops) { onApplyOp(op); }
      setResizeState(null);
    }
  }, [dragState, resizeState, snapTargets, getCanvasScale, artifactId, onApplyOp, nodes]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, objectId: string, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes[objectId] as unknown as Record<string, unknown> | undefined;
    if (!node) return;
    setResizeState({
      objectId, handle, startMouseX: e.clientX, startMouseY: e.clientY,
      startX: (node.x as number) ?? 0, startY: (node.y as number) ?? 0,
      startWidth: (node.width as number) ?? 100, startHeight: (node.height as number) ?? 50,
    });
  }, [nodes]);

  /** Get the effective position for a node, accounting for live drag */
  const getEffectivePos = useCallback((objId: string, nodeX: number, nodeY: number) => {
    if (liveDragPos && dragState?.objectId === objId) {
      return { x: liveDragPos.x, y: liveDragPos.y };
    }
    return { x: nodeX, y: nodeY };
  }, [liveDragPos, dragState]);

  if (!slide) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9e9e9e', fontSize: 15, fontFamily: 'system-ui, sans-serif', background: '#f0f0f0',
      }}>
        No slide selected
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#e8eaed', padding: 32, overflow: 'auto',
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
          width: SLIDE_WIDTH, height: SLIDE_HEIGHT, maxWidth: '100%',
          background: slide.backgroundColor ?? '#ffffff',
          backgroundImage: GRID_DOTS_BG,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.08)',
          borderRadius: 2, position: 'relative',
          aspectRatio: `${SLIDE_WIDTH}/${SLIDE_HEIGHT}`, outline: 'none',
        }}
      >
        {/* Alignment guide lines */}
        {activeGuides.map((guide, i) => (
          <div
            key={`guide-${i}`}
            style={{
              position: 'absolute',
              background: '#1a73e8',
              zIndex: 20,
              pointerEvents: 'none',
              ...(guide.orientation === 'vertical'
                ? { left: guide.position, top: 0, width: 1, height: SLIDE_HEIGHT }
                : { left: 0, top: guide.position, width: SLIDE_WIDTH, height: 1 }),
            }}
          />
        ))}

        {objectIds.map((objId) => {
          const node = nodes[objId] as unknown as Record<string, unknown> | undefined;
          if (!node) return null;

          const rawX = (node.x as number) ?? 0;
          const rawY = (node.y as number) ?? 0;
          const w = (node.width as number) ?? 100;
          const h = (node.height as number) ?? 50;
          const { x, y } = getEffectivePos(objId, rawX, rawY);
          const isSelected = objId === selectedObjectId;
          const isEditing = objId === editingObjectId;
          const isHovered = objId === hoveredObjectId && !isSelected;

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
                onMouseEnter={() => setHoveredObjectId(objId)}
                onMouseLeave={() => setHoveredObjectId(null)}
                style={{
                  position: 'absolute', left: x, top: y, width: w, height: h,
                  border: isSelected ? '2px dashed #1a73e8' : isHovered ? '1px solid rgba(26, 115, 232, 0.4)' : '1px solid transparent',
                  cursor: isEditing ? 'text' : 'move', boxSizing: 'border-box',
                  padding: isEditing ? 6 : 4, fontSize, fontWeight: isBold ? 700 : 400,
                  lineHeight: 1.3, overflow: 'hidden', outline: 'none',
                  color: (node.textColor as string) ?? undefined,
                  background: isEditing ? 'rgba(255, 255, 255, 0.95)'
                    : (node.fill as string | undefined) && node.fill !== 'transparent'
                      ? (node.fill as string)
                      : isSelected ? 'rgba(26, 115, 232, 0.03)'
                      : isHovered ? 'rgba(26, 115, 232, 0.02)' : 'transparent',
                  borderRadius: isEditing ? 2 : 0,
                  boxShadow: isEditing ? '0 0 0 2px #1a73e8, inset 0 0 0 1px rgba(26, 115, 232, 0.1)' : 'none',
                  caretColor: '#1a73e8',
                  transition: dragState ? 'none' : 'background 0.15s ease, border-color 0.15s ease',
                }}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={(e) => { if (isEditing) handleTextBlur(objId, e.currentTarget.textContent ?? ''); }}
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
                onMouseEnter={() => setHoveredObjectId(objId)}
                onMouseLeave={() => setHoveredObjectId(null)}
                style={{
                  position: 'absolute', left: x, top: y, width: w, height: h,
                  background: (node.fill as string) ?? '#ddd',
                  borderRadius: shapeType === 'ellipse' ? '50%' : shapeType === 'rounded_rect' ? 8 : 0,
                  border: isSelected ? '2px dashed #1a73e8'
                    : isHovered ? '2px solid rgba(26, 115, 232, 0.4)'
                    : node.stroke ? `1px solid ${node.stroke}` : '1px solid transparent',
                  cursor: 'move', boxSizing: 'border-box',
                  transition: dragState ? 'none' : 'border-color 0.15s ease',
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
                onMouseEnter={() => setHoveredObjectId(objId)}
                onMouseLeave={() => setHoveredObjectId(null)}
                style={{
                  position: 'absolute', left: x, top: y, width: w, height: h,
                  background: '#f5f5f5',
                  border: isSelected ? '2px dashed #1a73e8'
                    : isHovered ? '2px solid rgba(26, 115, 232, 0.4)' : '1px solid #e0e0e0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#9e9e9e', cursor: 'move', boxSizing: 'border-box',
                  transition: dragState ? 'none' : 'border-color 0.15s ease',
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
          const rawX = (node.x as number) ?? 0;
          const rawY = (node.y as number) ?? 0;
          const w = (node.width as number) ?? 100;
          const h = (node.height as number) ?? 50;
          const { x, y } = getEffectivePos(selectedObjectId, rawX, rawY);
          const handles = getHandlePositions(x, y, w, h);

          return (Object.entries(handles) as Array<[ResizeHandle, { left: number; top: number }]>).map(([handle, pos]) => (
            <div
              key={handle}
              onMouseDown={(e) => handleResizeMouseDown(e, selectedObjectId, handle)}
              style={{
                position: 'absolute', left: pos.left, top: pos.top,
                width: HANDLE_SIZE, height: HANDLE_SIZE,
                background: '#ffffff', border: '2px solid #1a73e8', borderRadius: '50%',
                cursor: HANDLE_CURSORS[handle], zIndex: 10, boxSizing: 'border-box',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
            />
          ));
        })()}
      </div>
    </div>
  );
};
