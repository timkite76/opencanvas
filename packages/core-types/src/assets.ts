import type { AssetID } from './ids.js';

export type AssetKind = 'image' | 'video' | 'audio' | 'file' | 'font' | 'other';

export interface AssetRef {
  assetId: AssetID;
  kind: AssetKind;
  mimeType: string;
  fileName: string;
  size?: number;
  path?: string;
}
