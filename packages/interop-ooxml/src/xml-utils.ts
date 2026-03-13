import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const defaultParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (_name: string, _jpath: string, isLeafNode: boolean, isAttribute: boolean) => {
    // Keep certain elements always as arrays for consistent handling
    if (isAttribute) return false;
    if (!isLeafNode) return false;
    return false;
  },
  preserveOrder: false,
  trimValues: false,
};

const defaultBuilderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  suppressEmptyNode: false,
  suppressBooleanAttributes: false,
};

/**
 * Parse an XML string into a JavaScript object using fast-xml-parser.
 */
export function parseXml(xml: string): Record<string, unknown> {
  const parser = new XMLParser(defaultParserOptions);
  return parser.parse(xml) as Record<string, unknown>;
}

/**
 * Build an XML string from a JavaScript object using fast-xml-parser.
 */
export function buildXml(obj: object): string {
  const builder = new XMLBuilder(defaultBuilderOptions);
  const xml = builder.build(obj) as string;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml;
}
