import { v4 as uuidv4 } from 'uuid';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode, TextRun } from '@opencanvas/deck-model';
import {
  readZip,
  parseXml,
  parseRelationships,
  type CompatibilityReport,
  createCompatReport,
  addReportEntry,
} from '@opencanvas/interop-ooxml';

// EMU (English Metric Unit) to pixel conversion
// 1 inch = 914400 EMU, 1 inch = 96 pixels => 1 EMU = 96/914400 = 1/9525 pixels
// Common approximation: divide by 12700 for points-like conversion
const EMU_TO_PX = 1 / 9525;

export async function importPptx(
  data: Uint8Array,
): Promise<{ artifact: ArtifactEnvelope<DeckNode>; report: CompatibilityReport }> {
  const zipFiles = await readZip(data);
  const report = createCompatReport();

  // Parse presentation.xml for slide list
  const presXml = zipFiles.get('ppt/presentation.xml');
  if (!presXml || typeof presXml !== 'string') {
    throw new Error('Invalid PPTX: missing ppt/presentation.xml');
  }

  const presParsed = parseXml(presXml) as Record<string, unknown>;
  const presentation = presParsed['p:presentation'] as Record<string, unknown> | undefined;
  if (!presentation) {
    throw new Error('Invalid PPTX: missing p:presentation element');
  }

  // Get slide references from presentation relationships
  const presRelsXml = zipFiles.get('ppt/_rels/presentation.xml.rels');
  const presRels = presRelsXml && typeof presRelsXml === 'string'
    ? parseRelationships(presRelsXml)
    : [];

  const rIdToTarget = new Map<string, string>();
  for (const rel of presRels) {
    rIdToTarget.set(rel.id, rel.target);
  }

  // Get slide list from presentation
  const sldIdLst = presentation['p:sldIdLst'] as Record<string, unknown> | undefined;
  const slideEntries = ensureArray(sldIdLst?.['p:sldId']);

  const nodes: Record<string, DeckNode> = {};
  const presentationId = uuidv4();
  const slideIds: string[] = [];

  for (const entry of slideEntries) {
    const sldId = entry as Record<string, unknown>;
    const rId = (sldId['@_r:id'] as string) ?? '';

    let slidePath = rIdToTarget.get(rId);
    if (slidePath) {
      if (!slidePath.startsWith('/')) {
        slidePath = 'ppt/' + slidePath;
      } else {
        slidePath = slidePath.substring(1);
      }
    } else {
      // Fallback
      const idx = slideIds.length + 1;
      slidePath = `ppt/slides/slide${idx}.xml`;
    }

    const slideXml = zipFiles.get(slidePath);
    if (!slideXml || typeof slideXml !== 'string') continue;

    const slideId = uuidv4();
    slideIds.push(slideId);

    const childIds = parseSlide(slideXml, slideId, nodes, report);

    const slideNode: DeckNode = {
      id: slideId,
      type: 'slide',
      parentId: presentationId,
      childIds,
    };
    nodes[slideId] = slideNode;
    addReportEntry(report, 'preserved', `slide ${slideIds.length}`);
  }

  // Build presentation root
  const presNode: DeckNode = {
    id: presentationId,
    type: 'presentation',
    childIds: slideIds,
  };
  nodes[presentationId] = presNode;

  // Check for unsupported features
  for (const [path] of zipFiles) {
    if (path.includes('slideMaster')) {
      addReportEntry(report, 'unsupported', 'slide masters');
    }
    if (path.includes('slideLayout')) {
      addReportEntry(report, 'unsupported', 'slide layouts');
    }
    if (path.includes('chart')) {
      addReportEntry(report, 'unsupported', 'charts');
    }
    if (path.startsWith('ppt/media/')) {
      addReportEntry(report, 'unsupported', 'embedded media (images/video/audio)');
    }
    if (path.includes('notesSlide')) {
      addReportEntry(report, 'approximated', 'speaker notes (skipped)');
    }
  }

  const now = new Date().toISOString();
  const artifact: ArtifactEnvelope<DeckNode> = {
    artifactId: uuidv4(),
    artifactType: 'presentation',
    title: 'Imported Presentation',
    version: { major: 1, minor: 0, patch: 0 },
    createdAt: now,
    updatedAt: now,
    rootNodeId: presentationId,
    nodes,
  };

  return { artifact, report };
}

function parseSlide(
  xml: string,
  slideId: string,
  nodes: Record<string, DeckNode>,
  report: CompatibilityReport,
): string[] {
  const parsed = parseXml(xml) as Record<string, unknown>;
  const slide = parsed['p:sld'] as Record<string, unknown> | undefined;
  if (!slide) return [];

  const cSld = slide['p:cSld'] as Record<string, unknown> | undefined;
  if (!cSld) return [];

  const spTree = cSld['p:spTree'] as Record<string, unknown> | undefined;
  if (!spTree) return [];

  const shapes = ensureArray(spTree['p:sp']);
  const childIds: string[] = [];

  for (const sp of shapes) {
    const shape = sp as Record<string, unknown>;

    // Get shape properties (position/size)
    const spPr = shape['p:spPr'] as Record<string, unknown> | undefined;
    const xfrm = spPr?.['a:xfrm'] as Record<string, unknown> | undefined;

    let x = 0;
    let y = 0;
    let width = 200;
    let height = 100;

    if (xfrm) {
      const off = xfrm['a:off'] as Record<string, unknown> | undefined;
      const ext = xfrm['a:ext'] as Record<string, unknown> | undefined;

      if (off) {
        x = Math.round(parseEmu(off['@_x']) * EMU_TO_PX);
        y = Math.round(parseEmu(off['@_y']) * EMU_TO_PX);
      }
      if (ext) {
        width = Math.round(parseEmu(ext['@_cx']) * EMU_TO_PX);
        height = Math.round(parseEmu(ext['@_cy']) * EMU_TO_PX);
      }

      addReportEntry(report, 'preserved', 'shape positions and sizes');
    }

    // Check for text body
    const txBody = shape['p:txBody'] as Record<string, unknown> | undefined;
    if (txBody) {
      const textRuns = extractTextFromTxBody(txBody, report);
      const nodeId = uuidv4();

      const textBoxNode: DeckNode = {
        id: nodeId,
        type: 'textbox',
        x,
        y,
        width,
        height,
        content: textRuns,
        parentId: slideId,
      };
      nodes[nodeId] = textBoxNode;
      childIds.push(nodeId);
      addReportEntry(report, 'preserved', 'text boxes');
    }
  }

  // Check for picture shapes
  const pics = ensureArray(spTree['p:pic']);
  if (pics.length > 0) {
    addReportEntry(report, 'unsupported', 'images on slides');
  }

  // Check for group shapes
  const grpSps = ensureArray(spTree['p:grpSp']);
  if (grpSps.length > 0) {
    addReportEntry(report, 'unsupported', 'grouped shapes');
  }

  // Check for connection shapes
  const cxnSps = ensureArray(spTree['p:cxnSp']);
  if (cxnSps.length > 0) {
    addReportEntry(report, 'unsupported', 'connector shapes');
  }

  return childIds;
}

function extractTextFromTxBody(
  txBody: Record<string, unknown>,
  report: CompatibilityReport,
): TextRun[] {
  const paragraphs = ensureArray(txBody['a:p']);
  const result: TextRun[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const p = paragraphs[pIdx] as Record<string, unknown>;
    const runs = ensureArray(p['a:r']);

    // Add newline between paragraphs (not before the first one)
    if (pIdx > 0 && result.length > 0) {
      result.push({ text: '\n' });
    }

    for (const r of runs) {
      const run = r as Record<string, unknown>;
      const rPr = run['a:rPr'] as Record<string, unknown> | undefined;

      const textEl = run['a:t'];
      let text = '';
      if (typeof textEl === 'string') {
        text = textEl;
      } else if (typeof textEl === 'number') {
        text = String(textEl);
      } else if (textEl && typeof textEl === 'object') {
        const textObj = textEl as Record<string, unknown>;
        const textContent = textObj['#text'];
        text = typeof textContent === 'string' ? textContent : String(textContent ?? '');
      }

      if (text.length === 0) continue;

      const textRun: TextRun = { text };

      if (rPr) {
        if (rPr['@_b'] === '1' || rPr['@_b'] === 'true') {
          textRun.bold = true;
          addReportEntry(report, 'preserved', 'bold text');
        }
        if (rPr['@_i'] === '1' || rPr['@_i'] === 'true') {
          textRun.italic = true;
          addReportEntry(report, 'preserved', 'italic text');
        }
        if (rPr['@_u'] && rPr['@_u'] !== 'none') {
          textRun.underline = true;
          addReportEntry(report, 'preserved', 'underlined text');
        }

        // Font size in hundredths of a point
        const sz = rPr['@_sz'];
        if (sz !== undefined) {
          const fontSize = parseInt(String(sz), 10) / 100;
          if (!isNaN(fontSize)) {
            textRun.fontSize = fontSize;
            addReportEntry(report, 'preserved', 'font sizes');
          }
        }

        // Font color
        const solidFill = rPr['a:solidFill'] as Record<string, unknown> | undefined;
        if (solidFill) {
          const srgbClr = solidFill['a:srgbClr'] as Record<string, unknown> | undefined;
          if (srgbClr) {
            const clrVal = srgbClr['@_val'] as string | undefined;
            if (clrVal) {
              textRun.color = '#' + clrVal;
              addReportEntry(report, 'preserved', 'text colors');
            }
          }
        }
      }

      result.push(textRun);
    }

    // If paragraph has no runs, it might be an empty line
    if (runs.length === 0) {
      // Check for endParaRPr which indicates an empty paragraph
      const endRpr = p['a:endParaRPr'];
      if (endRpr !== undefined) {
        result.push({ text: '' });
      }
    }
  }

  if (result.length === 0) {
    result.push({ text: '' });
  }

  return result;
}

function parseEmu(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function ensureArray(val: unknown): unknown[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}
