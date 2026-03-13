import { v4 as uuidv4 } from 'uuid';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { WriteNode, TextRun, InlineMark } from '@opencanvas/write-model';
import {
  readZip,
  parseXml,
  type CompatibilityReport,
  createCompatReport,
  addReportEntry,
} from '@opencanvas/interop-ooxml';

// Mapping from OOXML paragraph style names to heading levels
const HEADING_STYLE_MAP: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  Heading1: 1,
  Heading2: 2,
  Heading3: 3,
  Heading4: 4,
  Heading5: 5,
  Heading6: 6,
  heading1: 1,
  heading2: 2,
  heading3: 3,
  heading4: 4,
  heading5: 5,
  heading6: 6,
  'heading 1': 1,
  'heading 2': 2,
  'heading 3': 3,
  'heading 4': 4,
  'heading 5': 5,
  'heading 6': 6,
};

// List style identifiers
const LIST_STYLES = new Set([
  'ListParagraph',
  'ListBullet',
  'ListNumber',
  'ListBullet2',
  'ListNumber2',
]);

interface ImportContext {
  report: CompatibilityReport;
  nodes: Record<string, WriteNode>;
}

export async function importDocx(
  data: Uint8Array,
): Promise<{ artifact: ArtifactEnvelope<WriteNode>; report: CompatibilityReport }> {
  const zipFiles = await readZip(data);
  const report = createCompatReport();

  const documentXml = zipFiles.get('word/document.xml');
  if (!documentXml || typeof documentXml !== 'string') {
    throw new Error('Invalid DOCX: missing word/document.xml');
  }

  const parsed = parseXml(documentXml) as Record<string, unknown>;
  const documentEl = parsed['w:document'] as Record<string, unknown> | undefined;
  if (!documentEl) {
    throw new Error('Invalid DOCX: missing w:document element');
  }

  const body = documentEl['w:body'] as Record<string, unknown> | undefined;
  if (!body) {
    throw new Error('Invalid DOCX: missing w:body element');
  }

  const ctx: ImportContext = { report, nodes: {} };

  // Create document root
  const docId = uuidv4();
  const sectionId = uuidv4();

  const childIds: string[] = [];

  // Process paragraphs in body
  const paragraphs = ensureArray(body['w:p']);

  // Track list state
  let currentListId: string | null = null;
  let currentListItemIds: string[] = [];

  for (const p of paragraphs) {
    const para = p as Record<string, unknown>;

    // Check for unsupported elements
    checkForUnsupported(para, ctx);

    const pPr = para['w:pPr'] as Record<string, unknown> | undefined;
    const styleVal = getParagraphStyle(pPr);
    const headingLevel = styleVal ? HEADING_STYLE_MAP[styleVal] : undefined;
    const isListItem = isListParagraph(pPr, styleVal);

    // If we were in a list and this is not a list item, close the list
    if (currentListId && !isListItem) {
      const listNode = ctx.nodes[currentListId]!;
      (listNode as unknown as Record<string, unknown>)['childIds'] = [...currentListItemIds];
      currentListId = null;
      currentListItemIds = [];
    }

    if (headingLevel) {
      // Heading
      const nodeId = uuidv4();
      const content = extractTextRuns(para, ctx);
      const headingNode: WriteNode = {
        id: nodeId,
        type: 'heading',
        level: headingLevel,
        content,
        parentId: sectionId,
      };
      ctx.nodes[nodeId] = headingNode;
      childIds.push(nodeId);
      addReportEntry(report, 'preserved', `heading level ${headingLevel}`);
    } else if (isListItem) {
      // List item
      if (!currentListId) {
        // Start a new list
        currentListId = uuidv4();
        const numPr = pPr?.['w:numPr'] as Record<string, unknown> | undefined;
        const numId = numPr?.['w:numId'] as Record<string, unknown> | undefined;
        const numIdVal = numId?.['@_w:val'] as string | undefined;
        // Heuristic: odd numId values tend to be ordered, but we default to bullet
        const listType = numIdVal && parseInt(numIdVal, 10) % 2 === 0 ? 'ordered' : 'bullet';

        const listNode: WriteNode = {
          id: currentListId,
          type: 'list',
          listType,
          parentId: sectionId,
          childIds: [],
        };
        ctx.nodes[currentListId] = listNode;
        childIds.push(currentListId);
        addReportEntry(report, 'preserved', 'lists (basic)');
      }

      const itemId = uuidv4();
      const content = extractTextRuns(para, ctx);
      const itemNode: WriteNode = {
        id: itemId,
        type: 'list_item',
        content,
        parentId: currentListId,
      };
      ctx.nodes[itemId] = itemNode;
      currentListItemIds.push(itemId);
    } else {
      // Regular paragraph
      const nodeId = uuidv4();
      const content = extractTextRuns(para, ctx);
      const paraNode: WriteNode = {
        id: nodeId,
        type: 'paragraph',
        content,
        parentId: sectionId,
      };
      ctx.nodes[nodeId] = paraNode;
      childIds.push(nodeId);
      addReportEntry(report, 'preserved', 'paragraphs');
    }
  }

  // Close any trailing list
  if (currentListId) {
    const listNode = ctx.nodes[currentListId]!;
    (listNode as unknown as Record<string, unknown>)['childIds'] = [...currentListItemIds];
  }

  // Also check for tables in body
  const tables = ensureArray(body['w:tbl']);
  if (tables.length > 0) {
    addReportEntry(report, 'unsupported', 'tables');
  }

  // Check for other unsupported top-level elements
  const sdt = ensureArray(body['w:sdt']);
  if (sdt.length > 0) {
    addReportEntry(report, 'unsupported', 'structured document tags (SDT)');
  }

  // Build section node
  const sectionNode: WriteNode = {
    id: sectionId,
    type: 'section',
    parentId: docId,
    childIds,
  };
  ctx.nodes[sectionId] = sectionNode;

  // Build document node
  const docNode: WriteNode = {
    id: docId,
    type: 'document',
    childIds: [sectionId],
  };
  ctx.nodes[docId] = docNode;

  // Check for images, comments, footnotes in zip
  for (const [path] of zipFiles) {
    if (path.startsWith('word/media/')) {
      addReportEntry(report, 'unsupported', 'images');
    }
    if (path === 'word/comments.xml') {
      addReportEntry(report, 'unsupported', 'comments');
    }
    if (path === 'word/footnotes.xml') {
      addReportEntry(report, 'unsupported', 'footnotes');
    }
    if (path === 'word/endnotes.xml') {
      addReportEntry(report, 'unsupported', 'endnotes');
    }
  }

  const now = new Date().toISOString();
  const artifact: ArtifactEnvelope<WriteNode> = {
    artifactId: uuidv4(),
    artifactType: 'document',
    title: 'Imported Document',
    version: { major: 1, minor: 0, patch: 0 },
    createdAt: now,
    updatedAt: now,
    rootNodeId: docId,
    nodes: ctx.nodes,
  };

  return { artifact, report };
}

function extractTextRuns(
  para: Record<string, unknown>,
  ctx: ImportContext,
): TextRun[] {
  const runs = ensureArray(para['w:r']);
  const result: TextRun[] = [];

  for (const r of runs) {
    const run = r as Record<string, unknown>;
    const rPr = run['w:rPr'] as Record<string, unknown> | undefined;
    const marks = extractMarks(rPr, ctx);

    // Text can be w:t (regular text) or w:tab / w:br / etc.
    const textParts = ensureArray(run['w:t']);
    let text = '';
    for (const t of textParts) {
      if (typeof t === 'string') {
        text += t;
      } else if (t && typeof t === 'object') {
        const textObj = t as Record<string, unknown>;
        const textContent = textObj['#text'];
        if (typeof textContent === 'string') {
          text += textContent;
        } else if (typeof textContent === 'number') {
          text += String(textContent);
        }
      }
    }

    // Handle w:tab and w:br
    if (run['w:tab'] !== undefined) {
      text += '\t';
    }
    if (run['w:br'] !== undefined) {
      text += '\n';
    }

    if (text.length > 0) {
      const textRun: TextRun = { text };
      if (marks.length > 0) {
        textRun.marks = marks;
      }
      result.push(textRun);
    }
  }

  // If no runs found, return empty text run
  if (result.length === 0) {
    result.push({ text: '' });
  }

  return result;
}

function extractMarks(
  rPr: Record<string, unknown> | undefined,
  ctx: ImportContext,
): InlineMark[] {
  if (!rPr) return [];
  const marks: InlineMark[] = [];

  if (rPr['w:b'] !== undefined) {
    // w:b with @w:val="0" or @w:val="false" means NOT bold
    const val = (rPr['w:b'] as Record<string, unknown>)?.['@_w:val'];
    if (val !== '0' && val !== 'false') {
      marks.push('bold');
      addReportEntry(ctx.report, 'preserved', 'bold formatting');
    }
  }

  if (rPr['w:i'] !== undefined) {
    const val = (rPr['w:i'] as Record<string, unknown>)?.['@_w:val'];
    if (val !== '0' && val !== 'false') {
      marks.push('italic');
      addReportEntry(ctx.report, 'preserved', 'italic formatting');
    }
  }

  if (rPr['w:u'] !== undefined) {
    marks.push('underline');
    addReportEntry(ctx.report, 'preserved', 'underline formatting');
  }

  if (rPr['w:strike'] !== undefined) {
    marks.push('strikethrough');
    addReportEntry(ctx.report, 'preserved', 'strikethrough formatting');
  }

  // Font size, color, etc. are approximated or unsupported
  if (rPr['w:sz'] !== undefined) {
    addReportEntry(ctx.report, 'approximated', 'font size');
  }
  if (rPr['w:color'] !== undefined) {
    addReportEntry(ctx.report, 'approximated', 'text color');
  }
  if (rPr['w:rFonts'] !== undefined) {
    addReportEntry(ctx.report, 'approximated', 'font family');
  }
  if (rPr['w:highlight'] !== undefined) {
    addReportEntry(ctx.report, 'approximated', 'text highlight');
  }

  return marks;
}

function getParagraphStyle(
  pPr: Record<string, unknown> | undefined,
): string | undefined {
  if (!pPr) return undefined;
  const pStyle = pPr['w:pStyle'] as Record<string, unknown> | undefined;
  if (!pStyle) return undefined;
  return (pStyle['@_w:val'] as string) ?? undefined;
}

function isListParagraph(
  pPr: Record<string, unknown> | undefined,
  styleVal: string | undefined,
): boolean {
  if (!pPr) return false;
  // Check for w:numPr (numbering properties) which indicates a list
  if (pPr['w:numPr']) return true;
  // Check style name
  if (styleVal && LIST_STYLES.has(styleVal)) return true;
  return false;
}

function checkForUnsupported(
  para: Record<string, unknown>,
  ctx: ImportContext,
): void {
  // Check for drawing/image elements within runs
  const runs = ensureArray(para['w:r']);
  for (const r of runs) {
    const run = r as Record<string, unknown>;
    if (run['w:drawing'] !== undefined) {
      addReportEntry(ctx.report, 'unsupported', 'inline images');
    }
    if (run['w:pict'] !== undefined) {
      addReportEntry(ctx.report, 'unsupported', 'VML pictures');
    }
    if (run['w:object'] !== undefined) {
      addReportEntry(ctx.report, 'unsupported', 'embedded objects');
    }
  }

  // Check for bookmarks, hyperlinks
  if (para['w:hyperlink'] !== undefined) {
    addReportEntry(ctx.report, 'approximated', 'hyperlinks (text preserved, link lost)');
  }
  if (para['w:bookmarkStart'] !== undefined) {
    addReportEntry(ctx.report, 'omitted', 'bookmarks');
  }
}

function ensureArray(val: unknown): unknown[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}
