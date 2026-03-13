import type { Point } from '@opencanvas/deck-model';

export const DEFAULT_GRID_SIZE = 10;

export function snapToGrid(
  point: Point,
  gridSize: number = DEFAULT_GRID_SIZE,
): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}
