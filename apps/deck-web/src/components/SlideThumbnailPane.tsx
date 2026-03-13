import React, { useState } from 'react';
import type { ObjectID, BaseNode } from '@opencanvas/core-types';
import type { SlideIndex } from '@opencanvas/deck-model';

interface SlideThumbnailPaneProps {
  slideIds: ObjectID[];
  nodes: Record<ObjectID, BaseNode>;
  slideIndex: SlideIndex;
  selectedSlideId: string | null;
  onSlideSelect: (slideId: string) => void;
  onAddSlide: () => void;
}

const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const SCALE = THUMB_WIDTH / SLIDE_WIDTH;

export const SlideThumbnailPane: React.FC<SlideThumbnailPaneProps> = ({
  slideIds,
  nodes,
  slideIndex,
  selectedSlideId,
  onSlideSelect,
  onAddSlide,
}) => {
  const [hoveredSlideId, setHoveredSlideId] = useState<string | null>(null);

  return (
    <div
      style={{
        width: 220,
        borderRight: '1px solid #dadce0',
        background: '#f8f9fa',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        scrollbarWidth: 'thin' as const,
        scrollbarColor: '#bdbdbd transparent',
      }}
    >
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#5f6368',
        marginBottom: 8,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
      }}>
        Slides
      </div>

      {slideIds.map((slideId, index) => {
        const isSelected = slideId === selectedSlideId;
        const isHovered = slideId === hoveredSlideId && !isSelected;
        const objectIds = slideIndex.objectIdsBySlideId[slideId] ?? [];
        const slideNode = slideIndex.slideById[slideId];
        const slideBg = slideNode?.backgroundColor ?? '#ffffff';

        return (
          <div
            key={slideId}
            onClick={() => onSlideSelect(slideId)}
            onMouseEnter={() => setHoveredSlideId(slideId)}
            onMouseLeave={() => setHoveredSlideId(null)}
            style={{
              cursor: 'pointer',
              padding: '6px 6px 6px 0',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              background: isSelected
                ? 'rgba(26, 115, 232, 0.08)'
                : isHovered
                  ? 'rgba(0, 0, 0, 0.04)'
                  : 'transparent',
              transition: 'background 0.15s ease',
            }}
          >
            {/* Slide number */}
            <div style={{
              fontSize: 10,
              color: isSelected ? '#1a73e8' : '#80868b',
              fontWeight: isSelected ? 600 : 400,
              minWidth: 20,
              textAlign: 'right',
              paddingTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {index + 1}
            </div>

            {/* Thumbnail */}
            <div
              style={{
                width: THUMB_WIDTH,
                height: THUMB_HEIGHT,
                overflow: 'hidden',
                position: 'relative',
                background: slideBg,
                borderRadius: 4,
                border: isSelected
                  ? '2px solid #1a73e8'
                  : isHovered
                    ? '2px solid #a8c7fa'
                    : '2px solid #dadce0',
                boxShadow: isSelected
                  ? '0 1px 4px rgba(26, 115, 232, 0.25)'
                  : '0 1px 2px rgba(0,0,0,0.06)',
                flexShrink: 0,
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                boxSizing: 'border-box',
              }}
            >
              {objectIds.map((objId) => {
                const node = nodes[objId] as unknown as Record<string, unknown> | undefined;
                if (!node) return null;

                const x = (node.x as number ?? 0) * SCALE;
                const y = (node.y as number ?? 0) * SCALE;
                const w = (node.width as number ?? 100) * SCALE;
                const h = (node.height as number ?? 50) * SCALE;

                const content = node.content as Array<{ text: string; bold?: boolean; fontSize?: number }> | undefined;
                const text = content?.map((r) => r.text).join('') ?? '';
                const isBold = content?.[0]?.bold ?? false;

                if (node.type === 'textbox') {
                  return (
                    <div
                      key={objId}
                      style={{
                        position: 'absolute',
                        left: x,
                        top: y,
                        width: w,
                        height: h,
                        fontSize: Math.max(3, (content?.[0]?.fontSize ?? 16) * SCALE),
                        fontWeight: isBold ? 700 : 400,
                        overflow: 'hidden',
                        color: '#333',
                        lineHeight: 1.2,
                        pointerEvents: 'none',
                      }}
                    >
                      {text}
                    </div>
                  );
                }

                if (node.type === 'shape') {
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
                        borderRadius: node.shapeType === 'ellipse' ? '50%' : node.shapeType === 'rounded_rect' ? 4 : 0,
                        border: node.stroke ? `1px solid ${node.stroke}` : undefined,
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
                        background: '#f0f0f0',
                        border: '1px solid #e0e0e0',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                }

                return null;
              })}
            </div>
          </div>
        );
      })}

      <button
        onClick={onAddSlide}
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
        style={{
          padding: '8px 16px',
          background: 'transparent',
          color: '#1a73e8',
          border: '1px dashed #1a73e8',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          marginTop: 8,
          transition: 'background 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(26, 115, 232, 0.06)'}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'none'; }}
      >
        + Add Slide
      </button>
    </div>
  );
};
