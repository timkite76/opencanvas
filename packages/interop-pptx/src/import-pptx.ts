import { v4 as uuidv4 } from 'uuid';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { AssetRef } from '@opencanvas/core-types';
import type { DeckNode, TextRun, ImageObjectNode, SpeakerNotesNode } from '@opencanvas/deck-model';
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
const EMU_TO_PX = 1 / 9525;

/** Mime types by common PPTX image extensions */
const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.svg': 'image/svg+xml',
  '.emf': 'image/x-emf',
  '.wmf': 'image/x-wmf',
};

function mimeFromPath(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return 'application/octet-stream';
  const ext = filePath.substring(dot).toLowerCase();
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
}

export interface ImportPptxResult {
  artifact: ArtifactEnvelope<DeckNode>;
  report: CompatibilityReport;
  /** Binary data for imported assets keyed by assetId */
  assetData: Map<string, Uint8Array>;
}

export async function importPptx(
  data: Uint8Array,
): Promise<ImportPptxResult> {
  const zipFiles = await readZip(data);
  const report = createCompatReport();
  const assetData = new Map<string, Uint8Array>();
  const assets: AssetRef[] = [];

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

    // Parse slide relationships for images
    const slideRelsPath = slidePath.replace(
      /^(.*\/)?([^/]+)$/,
      '$1_rels/$2.rels',
    );
    const slideRelsXml = zipFiles.get(slideRelsPath);
    const slideRels = slideRelsXml && typeof slideRelsXml === 'string'
      ? parseRelationships(slideRelsXml)
      : [];

    const slideRelMap = new Map<string, string>();
    for (const rel of slideRels) {
      slideRelMap.set(rel.id, rel.target);
    }

    // Parse slide content (text boxes and images)
    const childIds = parseSlide(
      slideXml,
      slideId,
      nodes,
      report,
      slideRelMap,
      slidePath,
      zipFiles,
      assetData,
      assets,
    );

    // Parse speaker notes for this slide
    const notesTarget = findNotesTarget(slideRels);
    if (notesTarget) {
      const notesPath = resolveRelativePath(slidePath, notesTarget);
      const notesXml = zipFiles.get(notesPath);
      if (notesXml && typeof notesXml === 'string') {
        const notesContent = parseNotesSlide(notesXml, report);
        if (notesContent.length > 0) {
          const notesId = uuidv4();
          const notesNode: DeckNode = {
            id: notesId,
            type: 'speaker_notes',
            content: notesContent,
            parentId: slideId,
          };
          nodes[notesId] = notesNode;
          childIds.push(notesId);
          addReportEntry(report, 'preserved', 'speaker notes');
        }
      }
    }

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
    assets: assets.length > 0 ? assets : undefined,
  };

  return { artifact, report, assetData };
}

/**
 * Find the notes slide target from a slide's relationships.
 */
function findNotesTarget(rels: { id: string; type: string; target: string }[]): string | undefined {
  for (const rel of rels) {
    if (
      rel.type ===
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide'
    ) {
      return rel.target;
    }
  }
  return undefined;
}

/**
 * Resolve a relative target path against a base path (e.g. "../notesSlides/notesSlide1.xml"
 * relative to "ppt/slides/slide1.xml" -> "ppt/notesSlides/notesSlide1.xml").
 */
function resolveRelativePath(basePath: string, target: string): string {
  if (target.startsWith('/')) {
    return target.substring(1);
  }
  // Get directory of basePath
  const lastSlash = basePath.lastIndexOf('/');
  let dir = lastSlash >= 0 ? basePath.substring(0, lastSlash + 1) : '';

  let remaining = target;
  while (remaining.startsWith('../')) {
    remaining = remaining.substring(3);
    // Go up one directory
    const trimmed = dir.endsWith('/') ? dir.substring(0, dir.length - 1) : dir;
    const parentSlash = trimmed.lastIndexOf('/');
    dir = parentSlash >= 0 ? trimmed.substring(0, parentSlash + 1) : '';
  }

  return dir + remaining;
}

/**
 * Parse a notesSlide XML and extract text content.
 */
function parseNotesSlide(
  xml: string,
  report: CompatibilityReport,
): TextRun[] {
  const parsed = parseXml(xml) as Record<string, unknown>;
  const notes = parsed['p:notes'] as Record<string, unknown> | undefined;
  if (!notes) return [];

  const cSld = notes['p:cSld'] as Record<string, unknown> | undefined;
  if (!cSld) return [];

  const spTree = cSld['p:spTree'] as Record<string, unknown> | undefined;
  if (!spTree) return [];

  // Notes content is typically in a shape with type="body" or idx="1"
  // We look through all shapes for text bodies
  const shapes = ensureArray(spTree['p:sp']);
  const allRuns: TextRun[] = [];

  for (const sp of shapes) {
    const shape = sp as Record<string, unknown>;

    // Check if this is the notes body placeholder (type 12 = body, or ph idx 1)
    const nvSpPr = shape['p:nvSpPr'] as Record<string, unknown> | undefined;
    const nvPr = nvSpPr?.['p:nvPr'] as Record<string, unknown> | undefined;
    const ph = nvPr?.['p:ph'] as Record<string, unknown> | undefined;

    // Notes body placeholder has type="body" or idx="1"
    const phType = ph?.['@_type'] as string | undefined;
    const phIdx = ph?.['@_idx'] as string | undefined;

    // Skip the slide image placeholder (type="sldImg")
    if (phType === 'sldImg') continue;

    // Prefer the body placeholder, but take any text we can find
    const isBody = phType === 'body' || phIdx === '1';

    const txBody = shape['p:txBody'] as Record<string, unknown> | undefined;
    if (txBody && isBody) {
      const runs = extractTextFromTxBody(txBody, report);
      // Only add if there is actual text content
      const hasText = runs.some((r) => r.text.trim().length > 0);
      if (hasText) {
        if (allRuns.length > 0) {
          allRuns.push({ text: '\n' });
        }
        allRuns.push(...runs);
      }
    }
  }

  return allRuns;
}

function parseSlide(
  xml: string,
  slideId: string,
  nodes: Record<string, DeckNode>,
  report: CompatibilityReport,
  slideRelMap: Map<string, string>,
  slidePath: string,
  zipFiles: Map<string, string | Uint8Array>,
  assetData: Map<string, Uint8Array>,
  assets: AssetRef[],
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

  // Parse picture shapes (p:pic)
  const pics = ensureArray(spTree['p:pic']);
  for (const pic of pics) {
    const picObj = pic as Record<string, unknown>;
    const imageNode = parsePicElement(
      picObj,
      slideId,
      report,
      slideRelMap,
      slidePath,
      zipFiles,
      assetData,
      assets,
    );
    if (imageNode) {
      nodes[imageNode.id] = imageNode;
      childIds.push(imageNode.id);
    }
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

/**
 * Parse a p:pic element into an ImageObjectNode, extracting the referenced image.
 */
function parsePicElement(
  picObj: Record<string, unknown>,
  slideId: string,
  report: CompatibilityReport,
  slideRelMap: Map<string, string>,
  slidePath: string,
  zipFiles: Map<string, string | Uint8Array>,
  assetData: Map<string, Uint8Array>,
  assets: AssetRef[],
): ImageObjectNode | null {
  // Get position/size from spPr
  const spPr = picObj['p:spPr'] as Record<string, unknown> | undefined;
  const xfrm = spPr?.['a:xfrm'] as Record<string, unknown> | undefined;

  let x = 0;
  let y = 0;
  let width = 200;
  let height = 200;

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
  }

  // Get the image relationship ID from blipFill
  const blipFill = picObj['p:blipFill'] as Record<string, unknown> | undefined;
  const blip = blipFill?.['a:blip'] as Record<string, unknown> | undefined;
  const embedRId = (blip?.['@_r:embed'] as string) ?? '';

  if (!embedRId) {
    addReportEntry(report, 'approximated', 'image without embed reference');
    return null;
  }

  // Resolve the image path through relationships
  const imageTarget = slideRelMap.get(embedRId);
  if (!imageTarget) {
    addReportEntry(report, 'approximated', 'image with unresolved relationship');
    return null;
  }

  const imagePath = resolveRelativePath(slidePath, imageTarget);
  const imageBytes = zipFiles.get(imagePath);

  if (!imageBytes || typeof imageBytes === 'string') {
    addReportEntry(report, 'approximated', 'image with missing binary data');
    return null;
  }

  // Get alt text from nvPicPr
  const nvPicPr = picObj['p:nvPicPr'] as Record<string, unknown> | undefined;
  const cNvPr = nvPicPr?.['p:cNvPr'] as Record<string, unknown> | undefined;
  const alt = (cNvPr?.['@_descr'] as string) ?? undefined;

  // Determine filename from the path
  const lastSlash = imagePath.lastIndexOf('/');
  const fileName = lastSlash >= 0 ? imagePath.substring(lastSlash + 1) : imagePath;
  const mime = mimeFromPath(imagePath);

  const assetId = uuidv4();
  assetData.set(assetId, imageBytes);
  assets.push({
    assetId,
    kind: 'image',
    mimeType: mime,
    fileName,
    size: imageBytes.byteLength,
  });

  const nodeId = uuidv4();
  const imageNode: DeckNode = {
    id: nodeId,
    type: 'image_object',
    x,
    y,
    width,
    height,
    assetId,
    alt,
    parentId: slideId,
  };

  addReportEntry(report, 'preserved', 'images');
  return imageNode as ImageObjectNode;
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
