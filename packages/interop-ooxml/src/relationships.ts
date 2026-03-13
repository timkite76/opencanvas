import { parseXml, buildXml } from './xml-utils.js';

export interface Relationship {
  id: string;
  type: string;
  target: string;
}

/**
 * Parse a .rels XML file into an array of relationships.
 */
export function parseRelationships(xml: string): Relationship[] {
  const parsed = parseXml(xml) as Record<string, unknown>;
  const rels = parsed['Relationships'] as Record<string, unknown> | undefined;
  if (!rels) return [];

  const entries = ensureArray(rels['Relationship']);
  return entries.map((r) => {
    const rel = r as Record<string, unknown>;
    return {
      id: (rel['@_Id'] as string) ?? '',
      type: (rel['@_Type'] as string) ?? '',
      target: (rel['@_Target'] as string) ?? '',
    };
  });
}

/**
 * Build a .rels XML file from an array of relationships.
 */
export function buildRelationships(rels: Relationship[]): string {
  const relationships = rels.map((r) => ({
    '@_Id': r.id,
    '@_Type': r.type,
    '@_Target': r.target,
  }));

  const obj = {
    Relationships: {
      '@_xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships',
      Relationship: relationships,
    },
  };

  return buildXml(obj);
}

function ensureArray(val: unknown): unknown[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}
