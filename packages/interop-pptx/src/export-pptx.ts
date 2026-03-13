import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode, TextRun } from '@opencanvas/deck-model';
import {
  writeZip,
  buildXml,
  buildContentTypes,
  buildRelationships,
  type CompatibilityReport,
  createCompatReport,
  addReportEntry,
} from '@opencanvas/interop-ooxml';

// Pixel to EMU conversion (inverse of import)
const PX_TO_EMU = 9525;

// Default slide dimensions in EMUs (10 inches x 7.5 inches)
const SLIDE_WIDTH_EMU = 9144000;
const SLIDE_HEIGHT_EMU = 6858000;

export async function exportPptx(
  artifact: ArtifactEnvelope,
): Promise<{ data: Uint8Array; report: CompatibilityReport }> {
  const report = createCompatReport();
  const nodes = artifact.nodes as Record<string, DeckNode>;
  const rootNode = nodes[artifact.rootNodeId];

  if (!rootNode || rootNode.type !== 'presentation') {
    throw new Error('Root node must be a presentation');
  }

  const slideIds = rootNode.childIds ?? [];
  const files = new Map<string, string | Uint8Array>();

  // Build each slide
  const slideRels: { id: string; target: string }[] = [];

  for (let i = 0; i < slideIds.length; i++) {
    const slideNode = nodes[slideIds[i]];
    if (!slideNode || slideNode.type !== 'slide') continue;

    const slideIdx = i + 1;
    const slideXml = buildSlideXml(slideNode, nodes, report);
    files.set(`ppt/slides/slide${slideIdx}.xml`, slideXml);

    // Empty slide rels (no images, etc.)
    files.set(
      `ppt/slides/_rels/slide${slideIdx}.xml.rels`,
      buildRelationships([
        {
          id: 'rId1',
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
          target: '../slideLayouts/slideLayout1.xml',
        },
      ]),
    );

    slideRels.push({
      id: `rId${slideIdx}`,
      target: `slides/slide${slideIdx}.xml`,
    });

    addReportEntry(report, 'preserved', `slide ${slideIdx}`);
  }

  // Build a minimal slide layout
  const slideLayoutXml = buildXml({
    'p:sldLayout': {
      '@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      '@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      '@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      '@_type': 'blank',
      'p:cSld': {
        'p:spTree': {
          'p:nvGrpSpPr': {
            'p:cNvPr': { '@_id': '1', '@_name': '' },
            'p:cNvGrpSpPr': '',
            'p:nvPr': '',
          },
          'p:grpSpPr': {
            'a:xfrm': {
              'a:off': { '@_x': '0', '@_y': '0' },
              'a:ext': { '@_cx': '0', '@_cy': '0' },
              'a:chOff': { '@_x': '0', '@_y': '0' },
              'a:chExt': { '@_cx': '0', '@_cy': '0' },
            },
          },
        },
      },
    },
  });
  files.set('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml);
  files.set(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    buildRelationships([
      {
        id: 'rId1',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster',
        target: '../slideMasters/slideMaster1.xml',
      },
    ]),
  );

  // Build a minimal slide master
  const slideMasterXml = buildXml({
    'p:sldMaster': {
      '@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      '@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      '@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'p:cSld': {
        'p:spTree': {
          'p:nvGrpSpPr': {
            'p:cNvPr': { '@_id': '1', '@_name': '' },
            'p:cNvGrpSpPr': '',
            'p:nvPr': '',
          },
          'p:grpSpPr': {
            'a:xfrm': {
              'a:off': { '@_x': '0', '@_y': '0' },
              'a:ext': { '@_cx': '0', '@_cy': '0' },
              'a:chOff': { '@_x': '0', '@_y': '0' },
              'a:chExt': { '@_cx': '0', '@_cy': '0' },
            },
          },
        },
      },
      'p:sldLayoutIdLst': {
        'p:sldLayoutId': {
          '@_id': '2147483649',
          '@_r:id': 'rId1',
        },
      },
    },
  });
  files.set('ppt/slideMasters/slideMaster1.xml', slideMasterXml);
  files.set(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    buildRelationships([
      {
        id: 'rId1',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
        target: '../slideLayouts/slideLayout1.xml',
      },
    ]),
  );

  // Build presentation.xml
  const sldIdLst = slideRels.map((s, idx) => ({
    '@_id': String(256 + idx),
    '@_r:id': s.id,
  }));

  const presentationXml = buildXml({
    'p:presentation': {
      '@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      '@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      '@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'p:sldMasterIdLst': {
        'p:sldMasterId': {
          '@_id': '2147483648',
          '@_r:id': `rId${slideRels.length + 1}`,
        },
      },
      'p:sldIdLst': {
        'p:sldId': sldIdLst,
      },
      'p:sldSz': {
        '@_cx': String(SLIDE_WIDTH_EMU),
        '@_cy': String(SLIDE_HEIGHT_EMU),
      },
      'p:notesSz': {
        '@_cx': String(SLIDE_HEIGHT_EMU),
        '@_cy': String(SLIDE_WIDTH_EMU),
      },
    },
  });
  files.set('ppt/presentation.xml', presentationXml);

  // Presentation relationships
  const presRelEntries = slideRels.map((s) => ({
    id: s.id,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
    target: s.target,
  }));
  presRelEntries.push({
    id: `rId${slideRels.length + 1}`,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster',
    target: 'slideMasters/slideMaster1.xml',
  });
  files.set('ppt/_rels/presentation.xml.rels', buildRelationships(presRelEntries));

  // Root rels
  files.set(
    '_rels/.rels',
    buildRelationships([
      {
        id: 'rId1',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
        target: 'ppt/presentation.xml',
      },
    ]),
  );

  // Content types
  const overrides = [
    {
      partName: '/ppt/presentation.xml',
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
    },
    ...slideRels.map((_, idx) => ({
      partName: `/ppt/slides/slide${idx + 1}.xml`,
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml',
    })),
    {
      partName: '/ppt/slideLayouts/slideLayout1.xml',
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml',
    },
    {
      partName: '/ppt/slideMasters/slideMaster1.xml',
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml',
    },
  ];

  files.set(
    '[Content_Types].xml',
    buildContentTypes({
      defaults: [
        { extension: 'rels', contentType: 'application/vnd.openxmlformats-package.relationships+xml' },
        { extension: 'xml', contentType: 'application/xml' },
      ],
      overrides,
    }),
  );

  const zipData = await writeZip(files);
  return { data: zipData, report };
}

function buildSlideXml(
  slideNode: DeckNode,
  nodes: Record<string, DeckNode>,
  report: CompatibilityReport,
): string {
  const childIds = slideNode.childIds ?? [];
  const shapes: unknown[] = [];
  let spIdx = 2; // Start at 2 (1 is reserved for the group shape)

  for (const childId of childIds) {
    const child = nodes[childId];
    if (!child) continue;

    switch (child.type) {
      case 'textbox': {
        const tb = child as DeckNode & {
          type: 'textbox';
          x: number;
          y: number;
          width: number;
          height: number;
          content: TextRun[];
        };

        const xEmu = String(Math.round(tb.x * PX_TO_EMU));
        const yEmu = String(Math.round(tb.y * PX_TO_EMU));
        const cxEmu = String(Math.round(tb.width * PX_TO_EMU));
        const cyEmu = String(Math.round(tb.height * PX_TO_EMU));

        const textParas = buildTextParagraphs(tb.content, report);

        const shape = {
          'p:nvSpPr': {
            'p:cNvPr': { '@_id': String(spIdx++), '@_name': `TextBox ${spIdx}` },
            'p:cNvSpPr': { '@_txBox': '1' },
            'p:nvPr': '',
          },
          'p:spPr': {
            'a:xfrm': {
              'a:off': { '@_x': xEmu, '@_y': yEmu },
              'a:ext': { '@_cx': cxEmu, '@_cy': cyEmu },
            },
            'a:prstGeom': {
              '@_prst': 'rect',
              'a:avLst': '',
            },
          },
          'p:txBody': {
            'a:bodyPr': { '@_wrap': 'square', '@_rtlCol': '0' },
            'a:lstStyle': '',
            'a:p': textParas,
          },
        };

        shapes.push(shape);
        addReportEntry(report, 'preserved', 'text boxes');
        break;
      }

      case 'shape': {
        const sh = child as DeckNode & {
          type: 'shape';
          x: number;
          y: number;
          width: number;
          height: number;
          shapeType: string;
        };

        const prstMap: Record<string, string> = {
          rectangle: 'rect',
          ellipse: 'ellipse',
          rounded_rect: 'roundRect',
        };
        const prst = prstMap[sh.shapeType] ?? 'rect';

        const shape = {
          'p:nvSpPr': {
            'p:cNvPr': { '@_id': String(spIdx++), '@_name': `Shape ${spIdx}` },
            'p:cNvSpPr': '',
            'p:nvPr': '',
          },
          'p:spPr': {
            'a:xfrm': {
              'a:off': { '@_x': String(Math.round(sh.x * PX_TO_EMU)), '@_y': String(Math.round(sh.y * PX_TO_EMU)) },
              'a:ext': { '@_cx': String(Math.round(sh.width * PX_TO_EMU)), '@_cy': String(Math.round(sh.height * PX_TO_EMU)) },
            },
            'a:prstGeom': {
              '@_prst': prst,
              'a:avLst': '',
            },
          },
        };

        shapes.push(shape);
        addReportEntry(report, 'preserved', 'shapes');
        break;
      }

      case 'image_object': {
        addReportEntry(report, 'unsupported', 'images');
        break;
      }

      case 'speaker_notes': {
        addReportEntry(report, 'approximated', 'speaker notes (not exported to PPTX)');
        break;
      }

      default:
        break;
    }
  }

  return buildXml({
    'p:sld': {
      '@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      '@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      '@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'p:cSld': {
        'p:spTree': {
          'p:nvGrpSpPr': {
            'p:cNvPr': { '@_id': '1', '@_name': '' },
            'p:cNvGrpSpPr': '',
            'p:nvPr': '',
          },
          'p:grpSpPr': {
            'a:xfrm': {
              'a:off': { '@_x': '0', '@_y': '0' },
              'a:ext': { '@_cx': '0', '@_cy': '0' },
              'a:chOff': { '@_x': '0', '@_y': '0' },
              'a:chExt': { '@_cx': '0', '@_cy': '0' },
            },
          },
          'p:sp': shapes,
        },
      },
    },
  });
}

function buildTextParagraphs(
  content: TextRun[],
  report: CompatibilityReport,
): unknown[] {
  if (!content || content.length === 0) {
    return [{ 'a:endParaRPr': { '@_lang': 'en-US' } }];
  }

  // Split content by newlines into paragraphs
  const paragraphs: TextRun[][] = [[]];
  for (const run of content) {
    if (run.text === '\n') {
      paragraphs.push([]);
    } else {
      paragraphs[paragraphs.length - 1].push(run);
    }
  }

  return paragraphs.map((paraRuns) => {
    if (paraRuns.length === 0) {
      return { 'a:endParaRPr': { '@_lang': 'en-US' } };
    }

    const runs = paraRuns.map((run) => {
      const rPr: Record<string, unknown> = { '@_lang': 'en-US' };

      if (run.bold) {
        rPr['@_b'] = '1';
        addReportEntry(report, 'preserved', 'bold text');
      }
      if (run.italic) {
        rPr['@_i'] = '1';
        addReportEntry(report, 'preserved', 'italic text');
      }
      if (run.underline) {
        rPr['@_u'] = 'sng';
        addReportEntry(report, 'preserved', 'underlined text');
      }
      if (run.fontSize) {
        rPr['@_sz'] = String(Math.round(run.fontSize * 100));
        addReportEntry(report, 'preserved', 'font sizes');
      }
      if (run.color) {
        const hex = run.color.replace('#', '');
        rPr['a:solidFill'] = {
          'a:srgbClr': { '@_val': hex },
        };
        addReportEntry(report, 'preserved', 'text colors');
      }

      return {
        'a:rPr': rPr,
        'a:t': run.text,
      };
    });

    return { 'a:r': runs };
  });
}
