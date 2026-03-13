import { parseXml, buildXml } from './xml-utils.js';

export interface ContentTypeEntry {
  partName: string;
  contentType: string;
}

export interface DefaultContentType {
  extension: string;
  contentType: string;
}

export interface ContentTypesMap {
  defaults: DefaultContentType[];
  overrides: ContentTypeEntry[];
}

/**
 * Parse [Content_Types].xml into a structured map.
 */
export function parseContentTypes(xml: string): ContentTypesMap {
  const parsed = parseXml(xml) as Record<string, unknown>;
  const types = parsed['Types'] as Record<string, unknown> | undefined;
  if (!types) {
    return { defaults: [], overrides: [] };
  }

  const defaults: DefaultContentType[] = [];
  const overrides: ContentTypeEntry[] = [];

  const defaultEntries = ensureArray(types['Default']);
  for (const d of defaultEntries) {
    const entry = d as Record<string, unknown>;
    defaults.push({
      extension: (entry['@_Extension'] as string) ?? '',
      contentType: (entry['@_ContentType'] as string) ?? '',
    });
  }

  const overrideEntries = ensureArray(types['Override']);
  for (const o of overrideEntries) {
    const entry = o as Record<string, unknown>;
    overrides.push({
      partName: (entry['@_PartName'] as string) ?? '',
      contentType: (entry['@_ContentType'] as string) ?? '',
    });
  }

  return { defaults, overrides };
}

/**
 * Build [Content_Types].xml from a structured map.
 */
export function buildContentTypes(map: ContentTypesMap): string {
  const defaults = map.defaults.map((d) => ({
    '@_Extension': d.extension,
    '@_ContentType': d.contentType,
  }));

  const overrides = map.overrides.map((o) => ({
    '@_PartName': o.partName,
    '@_ContentType': o.contentType,
  }));

  const obj: Record<string, unknown> = {
    Types: {
      '@_xmlns': 'http://schemas.openxmlformats.org/package/2006/content-types',
      Default: defaults,
      Override: overrides,
    },
  };

  return buildXml(obj);
}

function ensureArray(val: unknown): unknown[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}
