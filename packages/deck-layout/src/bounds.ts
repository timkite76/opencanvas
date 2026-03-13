import type { Rect } from '@opencanvas/deck-model';

export const DEFAULT_SLIDE_WIDTH = 960;
export const DEFAULT_SLIDE_HEIGHT = 540;

export function clampToSlide(
  rect: Rect,
  slideWidth: number = DEFAULT_SLIDE_WIDTH,
  slideHeight: number = DEFAULT_SLIDE_HEIGHT,
): Rect {
  let { x, y, width, height } = rect;

  // Clamp dimensions to slide bounds
  width = Math.min(width, slideWidth);
  height = Math.min(height, slideHeight);

  // Clamp position so the object stays within the slide
  x = Math.max(0, Math.min(x, slideWidth - width));
  y = Math.max(0, Math.min(y, slideHeight - height));

  return { x, y, width, height };
}

export function centerOnSlide(
  width: number,
  height: number,
  slideWidth: number = DEFAULT_SLIDE_WIDTH,
  slideHeight: number = DEFAULT_SLIDE_HEIGHT,
): Rect {
  return {
    x: Math.round((slideWidth - width) / 2),
    y: Math.round((slideHeight - height) / 2),
    width,
    height,
  };
}
