import React, { useCallback } from 'react';
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
  return (
    <div
      style={{
        width: 200,
        borderRight: '1px solid #ddd',
        background: '#f5f5f5',
        overflow: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
        Slides
      </div>

      {slideIds.map((slideId, index) => {
        const isSelected = slideId === selectedSlideId;
        const objectIds = slideIndex.objectIdsBySlideId[slideId] ?? [];

        return (
          <div
            key={slideId}
            onClick={() => onSlideSelect(slideId)}
            style={{
              cursor: 'pointer',
              border: isSelected ? '2px solid #1a73e8' : '2px solid transparent',
              borderRadius: 4,
              background: '#fff',
              padding: 2,
            }}
          >
            <div style={{ fontSize: 10, color: '#888', marginBottom: 2, paddingLeft: 2 }}>
              {index + 1}
            </div>
            <div
              style={{
                width: THUMB_WIDTH,
                height: THUMB_HEIGHT,
                overflow: 'hidden',
                position: 'relative',
                background: '#fff',
                borderRadius: 2,
              }}
            >
              {objectIds.map((objId) => {
                const node = nodes[objId] as unknown as Record<string, unknown> | undefined;
                if (!node) return null;

                const x = (node.x as number ?? 0) * SCALE;
                const y = (node.y as number ?? 0) * SCALE;
                const w = (node.width as number ?? 100) * SCALE;
                const h = (node.height as number ?? 50) * SCALE;

                const content = node.content as Array<{ text: string }> | undefined;
                const text = content?.map((r) => r.text).join('') ?? '';

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
                        fontSize: 4,
                        overflow: 'hidden',
                        color: '#333',
                        lineHeight: 1.2,
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
        style={{
          padding: '6px 12px',
          background: '#1a73e8',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          fontSize: 12,
          marginTop: 4,
        }}
      >
        + Add Slide
      </button>
    </div>
  );
};
