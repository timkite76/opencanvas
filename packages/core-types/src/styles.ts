import type { StyleID, ThemeID } from './ids.js';

export interface StyleRef {
  styleId: StyleID;
  name: string;
  properties: Record<string, unknown>;
}

export interface ThemeRef {
  themeId: ThemeID;
  name: string;
  properties: Record<string, unknown>;
}
