import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ObjectID, BaseNode } from '@opencanvas/core-types';
import type { SlideIndex } from '@opencanvas/deck-model';

interface PresentationModeProps {
  slideIds: ObjectID[];
  nodes: Record<ObjectID, BaseNode>;
  slideIndex: SlideIndex;
  startSlideIndex: number;
  onExit: () => void;
}

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

export const PresentationMode: React.FC<PresentationModeProps> = ({
  slideIds,
  nodes,
  slideIndex,
  startSlideIndex,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState(startSlideIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const totalSlides = slideIds.length;

  // Request fullscreen on mount, exit fullscreen on unmount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Fullscreen may be blocked by browser policy; continue without it
      }
    };
    enterFullscreen();

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onExit();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [onExit]);

  // Track container dimensions for scaling
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Focus container for keyboard events
  useEffect(() => {
    containerRef.current?.focus();
  }, [currentIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, totalSlides - 1));
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'Backspace':
          e.preventDefault();
          goPrev();
          break;
        case 'Escape':
          e.preventDefault();
          onExit();
          break;
      }
    },
    [goNext, goPrev, onExit],
  );

  const handleClick = useCallback(() => {
    goNext();
  }, [goNext]);

  // Calculate scale to fit slide in viewport maintaining 16:9
  const scale = Math.min(
    dimensions.width / SLIDE_WIDTH,
    dimensions.height / SLIDE_HEIGHT,
  );

  const currentSlideId = slideIds[currentIndex];
  const slideNode = currentSlideId ? slideIndex.slideById[currentSlideId] : undefined;
  const objectIds = currentSlideId ? (slideIndex.objectIdsBySlideId[currentSlideId] ?? []) : [];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        outline: 'none',
        cursor: 'none',
      }}
    >
      {/* Scaled slide */}
      <div
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background: slideNode?.backgroundColor ?? '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 0 80px rgba(0,0,0,0.5)',
        }}
      >
        {objectIds.map((objId) => {
          const node = nodes[objId] as unknown as Record<string, unknown> | undefined;
          if (!node) return null;

          const x = (node.x as number) ?? 0;
          const y = (node.y as number) ?? 0;
          const w = (node.width as number) ?? 100;
          const h = (node.height as number) ?? 50;

          if (node.type === 'textbox') {
            const content = node.content as Array<{
              text: string;
              bold?: boolean;
              italic?: boolean;
              underline?: boolean;
              fontSize?: number;
              fontFamily?: string;
              color?: string;
            }> | undefined;
            const text = content?.map((r) => r.text).join('') ?? '';
            const firstRun = content?.[0];
            const fontSize = firstRun?.fontSize ?? 16;
            const isBold = firstRun?.bold ?? false;
            const isItalic = firstRun?.italic ?? false;
            const isUnderline = firstRun?.underline ?? false;
            const fontFamily = firstRun?.fontFamily ?? 'system-ui, sans-serif';
            const color = firstRun?.color ?? '#000000';

            return (
              <div
                key={objId}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  fontSize,
                  fontWeight: isBold ? 700 : 400,
                  fontStyle: isItalic ? 'italic' : 'normal',
                  textDecoration: isUnderline ? 'underline' : 'none',
                  fontFamily,
                  color,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  padding: 4,
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
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
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  background: (node.fill as string) ?? '#ddd',
                  borderRadius:
                    shapeType === 'ellipse'
                      ? '50%'
                      : shapeType === 'rounded_rect'
                        ? 8
                        : 0,
                  border: node.stroke ? `1px solid ${node.stroke as string}` : undefined,
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                }}
              />
            );
          }

          if (node.type === 'image_object') {
            return (
              <div
                key={objId}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  background: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  color: '#9e9e9e',
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                }}
              >
                {(node.alt as string) ?? 'Image'}
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Slide number indicator */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 24,
          color: '#ffffff',
          background: 'rgba(0, 0, 0, 0.45)',
          padding: '4px 12px',
          borderRadius: 4,
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {currentIndex + 1} / {totalSlides}
      </div>
    </div>
  );
};
