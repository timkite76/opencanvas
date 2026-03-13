import type { Rect } from '@opencanvas/deck-model';
import { DEFAULT_SLIDE_WIDTH, DEFAULT_SLIDE_HEIGHT } from './bounds.js';

export type AlignmentMode =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom';

export function alignObjects(
  rects: Rect[],
  mode: AlignmentMode,
  slideWidth: number = DEFAULT_SLIDE_WIDTH,
  slideHeight: number = DEFAULT_SLIDE_HEIGHT,
): Rect[] {
  if (rects.length === 0) return [];

  switch (mode) {
    case 'left': {
      const minX = Math.min(...rects.map((r) => r.x));
      return rects.map((r) => ({ ...r, x: minX }));
    }
    case 'center': {
      const centerX = slideWidth / 2;
      return rects.map((r) => ({ ...r, x: centerX - r.width / 2 }));
    }
    case 'right': {
      const maxRight = Math.max(...rects.map((r) => r.x + r.width));
      return rects.map((r) => ({ ...r, x: maxRight - r.width }));
    }
    case 'top': {
      const minY = Math.min(...rects.map((r) => r.y));
      return rects.map((r) => ({ ...r, y: minY }));
    }
    case 'middle': {
      const centerY = slideHeight / 2;
      return rects.map((r) => ({ ...r, y: centerY - r.height / 2 }));
    }
    case 'bottom': {
      const maxBottom = Math.max(...rects.map((r) => r.y + r.height));
      return rects.map((r) => ({ ...r, y: maxBottom - r.height }));
    }
  }
}
