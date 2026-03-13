import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { WriteNode, TextRun, InlineMark } from '@opencanvas/write-model';
import {
  writeZip,
  buildXml,
  buildContentTypes,
  buildRelationships,
  type CompatibilityReport,
  createCompatReport,
  addReportEntry,
} from '@opencanvas/interop-ooxml';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';

const HEADING_STYLE_MAP: Record<number, string> = {
  1: 'Heading1',
  2: 'Heading2',
  3: 'Heading3',
  4: 'Heading4',
  5: 'Heading5',
  6: 'Heading6',
};

export async function exportDocx(
  artifact: ArtifactEnvelope,
): Promise<{ data: Uint8Array; report: CompatibilityReport }> {
  const report = createCompatReport();
  const nodes = artifact.nodes as Record<string, WriteNode>;
  const rootNode = nodes[artifact.rootNodeId];

  if (!rootNode) {
    throw new Error('Root node not found in artifact');
  }

  // Collect body paragraphs by walking the tree
  const bodyElements: unknown[] = [];
  walkNode(rootNode, nodes, bodyElements, report);

  // Build document.xml
  const documentXml = buildXml({
    'w:document': {
      '@_xmlns:w': W_NS,
      '@_xmlns:r': R_NS,
      '@_xmlns:wp': WP_NS,
      'w:body': {
        'w:p': bodyElements,
      },
    },
  });

  // Build content types
  const contentTypesXml = buildContentTypes({
    defaults: [
      { extension: 'rels', contentType: 'application/vnd.openxmlformats-package.relationships+xml' },
      { extension: 'xml', contentType: 'application/xml' },
    ],
    overrides: [
      {
        partName: '/word/document.xml',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
      },
    ],
  });

  // Build relationships
  const rootRels = buildRelationships([
    {
      id: 'rId1',
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
      target: 'word/document.xml',
    },
  ]);

  const docRels = buildRelationships([]);

  // Package zip
  const files = new Map<string, string | Uint8Array>();
  files.set('[Content_Types].xml', contentTypesXml);
  files.set('_rels/.rels', rootRels);
  files.set('word/document.xml', documentXml);
  files.set('word/_rels/document.xml.rels', docRels);

  const zipData = await writeZip(files);

  return { data: zipData, report };
}

function walkNode(
  node: WriteNode,
  nodes: Record<string, WriteNode>,
  bodyElements: unknown[],
  report: CompatibilityReport,
): void {
  switch (node.type) {
    case 'document':
    case 'section': {
      // Container nodes: walk children
      if (node.childIds) {
        for (const childId of node.childIds) {
          const child = nodes[childId];
          if (child) {
            walkNode(child, nodes, bodyElements, report);
          }
        }
      }
      break;
    }

    case 'heading': {
      const headingNode = node as WriteNode & { type: 'heading'; level: number; content: TextRun[] };
      const runs = buildTextRuns(headingNode.content, report);
      const styleName = HEADING_STYLE_MAP[headingNode.level] ?? 'Heading1';

      const para: Record<string, unknown> = {
        'w:pPr': {
          'w:pStyle': { '@_w:val': styleName },
        },
        'w:r': runs,
      };
      bodyElements.push(para);
      addReportEntry(report, 'preserved', `heading level ${headingNode.level}`);
      break;
    }

    case 'paragraph': {
      const paraNode = node as WriteNode & { type: 'paragraph'; content: TextRun[] };
      const runs = buildTextRuns(paraNode.content, report);
      const para: Record<string, unknown> = {
        'w:r': runs,
      };
      bodyElements.push(para);
      addReportEntry(report, 'preserved', 'paragraphs');
      break;
    }

    case 'list': {
      const listNode = node as WriteNode & { type: 'list'; listType: string };
      if (listNode.childIds) {
        for (const itemId of listNode.childIds) {
          const itemNode = nodes[itemId];
          if (itemNode && itemNode.type === 'list_item') {
            const item = itemNode as WriteNode & { type: 'list_item'; content: TextRun[] };
            const runs = buildTextRuns(item.content, report);
            const numId = listNode.listType === 'ordered' ? '2' : '1';
            const para: Record<string, unknown> = {
              'w:pPr': {
                'w:pStyle': { '@_w:val': 'ListParagraph' },
                'w:numPr': {
                  'w:ilvl': { '@_w:val': '0' },
                  'w:numId': { '@_w:val': numId },
                },
              },
              'w:r': runs,
            };
            bodyElements.push(para);
          }
        }
      }
      addReportEntry(report, 'preserved', 'lists (basic)');
      break;
    }

    case 'image': {
      // Images are unsupported for export; emit an empty paragraph as placeholder
      bodyElements.push({
        'w:r': [
          {
            'w:t': { '#text': '[Image placeholder]', '@_xml:space': 'preserve' },
          },
        ],
      });
      addReportEntry(report, 'unsupported', 'images');
      break;
    }

    case 'table':
    case 'table_row':
    case 'table_cell': {
      addReportEntry(report, 'unsupported', 'tables');
      break;
    }

    case 'semantic_block': {
      // Export semantic blocks as regular paragraphs
      const sbNode = node as WriteNode & { type: 'semantic_block'; content: TextRun[] };
      const runs = buildTextRuns(sbNode.content, report);
      bodyElements.push({
        'w:r': runs,
      });
      addReportEntry(report, 'approximated', 'semantic blocks (exported as paragraphs)');
      break;
    }

    default: {
      // Skip unknown node types
      addReportEntry(report, 'omitted', `unknown node type: ${node.type}`);
      break;
    }
  }
}

function buildTextRuns(
  content: TextRun[],
  report: CompatibilityReport,
): unknown[] {
  if (!content || content.length === 0) {
    return [
      {
        'w:t': { '#text': '', '@_xml:space': 'preserve' },
      },
    ];
  }

  return content.map((run) => {
    const result: Record<string, unknown> = {};

    // Build run properties
    const marks = run.marks ?? [];
    if (marks.length > 0) {
      const rPr: Record<string, unknown> = {};
      for (const mark of marks) {
        switch (mark) {
          case 'bold':
            rPr['w:b'] = '';
            addReportEntry(report, 'preserved', 'bold formatting');
            break;
          case 'italic':
            rPr['w:i'] = '';
            addReportEntry(report, 'preserved', 'italic formatting');
            break;
          case 'underline':
            rPr['w:u'] = { '@_w:val': 'single' };
            addReportEntry(report, 'preserved', 'underline formatting');
            break;
          case 'strikethrough':
            rPr['w:strike'] = '';
            addReportEntry(report, 'preserved', 'strikethrough formatting');
            break;
          case 'code':
            // Approximate code with monospace font
            rPr['w:rFonts'] = { '@_w:ascii': 'Courier New', '@_w:hAnsi': 'Courier New' };
            addReportEntry(report, 'approximated', 'code formatting (monospace font)');
            break;
        }
      }
      result['w:rPr'] = rPr;
    }

    result['w:t'] = {
      '#text': run.text,
      '@_xml:space': 'preserve',
    };

    return result;
  });
}
