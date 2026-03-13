import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode, TextRun, SpeakerNotesNode, ImageObjectNode } from '@opencanvas/deck-model';
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

/** Extension-to-PPTX-content-type defaults for images */
const IMAGE_EXT_CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  svg: 'image/svg+xml',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
};

export interface ExportPptxOptions {
  /**
   * Binary data for assets keyed by assetId.
   * Required when the artifact contains image_object nodes.
   */
  assetData?: Map<string, Uint8Array>;
}

export async function exportPptx(
  artifact: ArtifactEnvelope,
  options?: ExportPptxOptions,
): Promise<{ data: Uint8Array; report: CompatibilityReport }> {
  const report = createCompatReport();
  const nodes = artifact.nodes as Record<string, DeckNode>;
  const rootNode = nodes[artifact.rootNodeId];

  if (!rootNode || rootNode.type !== 'presentation') {
    throw new Error('Root node must be a presentation');
  }

  const assetDataMap = options?.assetData ?? new Map<string, Uint8Array>();
  const assetRefs = artifact.assets ?? [];
  const assetRefsById = new Map(assetRefs.map((a) => [a.assetId, a]));

  const slideIds = rootNode.childIds ?? [];
  const files = new Map<string, string | Uint8Array>();

  // Track image extensions used (for Content_Types defaults)
  const imageExtensions = new Set<string>();

  // Build each slide
  const slideRels: { id: string; target: string }[] = [];

  for (let i = 0; i < slideIds.length; i++) {
    const slideNode = nodes[slideIds[i]];
    if (!slideNode || slideNode.type !== 'slide') continue;

    const slideIdx = i + 1;
    const childIds = slideNode.childIds ?? [];

    // Collect speaker notes and image nodes from children
    let notesNode: SpeakerNotesNode | undefined;
    const imageNodes: (ImageObjectNode & { childId: string })[] = [];

    for (const childId of childIds) {
      const child = nodes[childId];
      if (!child) continue;
      if (child.type === 'speaker_notes') {
        notesNode = child as SpeakerNotesNode;
      }
      if (child.type === 'image_object') {
        imageNodes.push(child as ImageObjectNode & { childId: string });
      }
    }

    // Build slide relationship entries
    // rId1 is always slideLayout
    const slideRelEntries: { id: string; type: string; target: string }[] = [
      {
        id: 'rId1',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
        target: '../slideLayouts/slideLayout1.xml',
      },
    ];
    let nextRId = 2;

    // Add notes relationship if we have speaker notes
    let notesRId: string | undefined;
    if (notesNode) {
      notesRId = `rId${nextRId++}`;
      slideRelEntries.push({
        id: notesRId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide',
        target: `../notesSlides/notesSlide${slideIdx}.xml`,
      });
    }

    // Add image relationships and embed image data
    const imageRIdMap = new Map<string, string>(); // assetId -> rId
    for (const imgNode of imageNodes) {
      const assetRef = assetRefsById.get(imgNode.assetId);
      const imgBytes = assetDataMap.get(imgNode.assetId);

      if (!imgBytes) {
        addReportEntry(report, 'approximated', 'image with missing asset data (skipped)');
        continue;
      }

      const fileName = assetRef?.fileName ?? `image_${imgNode.assetId}.png`;
      const ext = getExtension(fileName);

      const mediaPath = `ppt/media/${fileName}`;
      files.set(mediaPath, imgBytes);

      if (ext) {
        imageExtensions.add(ext);
      }

      const imgRId = `rId${nextRId++}`;
      imageRIdMap.set(imgNode.assetId, imgRId);
      slideRelEntries.push({
        id: imgRId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        target: `../media/${fileName}`,
      });
    }

    // Build slide XML with image rId references
    const slideXml = buildSlideXml(slideNode, nodes, report, imageRIdMap);
    files.set(`ppt/slides/slide${slideIdx}.xml`, slideXml);

    // Write slide rels
    files.set(
      `ppt/slides/_rels/slide${slideIdx}.xml.rels`,
      buildRelationships(slideRelEntries),
    );

    // Build notes slide if present
    if (notesNode && notesRId) {
      const notesXml = buildNotesSlideXml(notesNode, slideIdx, report);
      files.set(`ppt/notesSlides/notesSlide${slideIdx}.xml`, notesXml);

      // Notes slide rels - references the slide
      files.set(
        `ppt/notesSlides/_rels/notesSlide${slideIdx}.xml.rels`,
        buildRelationships([
          {
            id: 'rId1',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
            target: `../slides/slide${slideIdx}.xml`,
          },
        ]),
      );

      addReportEntry(report, 'preserved', 'speaker notes');
    }

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
  const defaults = [
    { extension: 'rels', contentType: 'application/vnd.openxmlformats-package.relationships+xml' },
    { extension: 'xml', contentType: 'application/xml' },
  ];

  // Add image extension defaults
  for (const ext of imageExtensions) {
    const ct = IMAGE_EXT_CONTENT_TYPE[ext];
    if (ct) {
      defaults.push({ extension: ext, contentType: ct });
    }
  }

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

  // Add notes slide content type overrides
  for (let i = 0; i < slideIds.length; i++) {
    const slideNode = nodes[slideIds[i]];
    if (!slideNode || slideNode.type !== 'slide') continue;
    const childNodeIds = slideNode.childIds ?? [];
    const hasNotes = childNodeIds.some((cid) => {
      const child = nodes[cid];
      return child?.type === 'speaker_notes';
    });
    if (hasNotes) {
      overrides.push({
        partName: `/ppt/notesSlides/notesSlide${i + 1}.xml`,
        contentType:
          'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml',
      });
    }
  }

  files.set(
    '[Content_Types].xml',
    buildContentTypes({ defaults, overrides }),
  );

  const zipData = await writeZip(files);
  return { data: zipData, report };
}

function buildSlideXml(
  slideNode: DeckNode,
  nodes: Record<string, DeckNode>,
  report: CompatibilityReport,
  imageRIdMap: Map<string, string>,
): string {
  const childIds = slideNode.childIds ?? [];
  const shapes: unknown[] = [];
  const pics: unknown[] = [];
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
        const img = child as ImageObjectNode;
        const rId = imageRIdMap.get(img.assetId);
        if (!rId) {
          // No asset data was available, already reported in the main loop
          break;
        }

        const xEmu = String(Math.round(img.x * PX_TO_EMU));
        const yEmu = String(Math.round(img.y * PX_TO_EMU));
        const cxEmu = String(Math.round(img.width * PX_TO_EMU));
        const cyEmu = String(Math.round(img.height * PX_TO_EMU));

        const picElement = {
          'p:nvPicPr': {
            'p:cNvPr': {
              '@_id': String(spIdx++),
              '@_name': `Image ${spIdx}`,
              ...(img.alt ? { '@_descr': img.alt } : {}),
            },
            'p:cNvPicPr': {
              'a:picLocks': { '@_noChangeAspect': '1' },
            },
            'p:nvPr': '',
          },
          'p:blipFill': {
            'a:blip': { '@_r:embed': rId },
            'a:stretch': {
              'a:fillRect': '',
            },
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
        };

        pics.push(picElement);
        addReportEntry(report, 'preserved', 'images');
        break;
      }

      case 'speaker_notes': {
        // Handled separately via notesSlide generation
        break;
      }

      default:
        break;
    }
  }

  const spTreeContent: Record<string, unknown> = {
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
  };

  if (shapes.length > 0) {
    spTreeContent['p:sp'] = shapes;
  }
  if (pics.length > 0) {
    spTreeContent['p:pic'] = pics;
  }

  return buildXml({
    'p:sld': {
      '@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      '@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      '@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'p:cSld': {
        'p:spTree': spTreeContent,
      },
    },
  });
}

/**
 * Build a notesSlide XML for a slide's speaker notes.
 */
function buildNotesSlideXml(
  notesNode: SpeakerNotesNode,
  slideIdx: number,
  report: CompatibilityReport,
): string {
  const textParas = buildTextParagraphs(notesNode.content, report);

  return buildXml({
    'p:notes': {
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
          'p:sp': [
            // Slide image placeholder
            {
              'p:nvSpPr': {
                'p:cNvPr': { '@_id': '2', '@_name': 'Slide Image Placeholder 1' },
                'p:cNvSpPr': {
                  'a:spLocks': { '@_noGrp': '1', '@_noRot': '1', '@_noChangeAspect': '1' },
                },
                'p:nvPr': {
                  'p:ph': { '@_type': 'sldImg' },
                },
              },
              'p:spPr': '',
            },
            // Notes body placeholder
            {
              'p:nvSpPr': {
                'p:cNvPr': { '@_id': '3', '@_name': 'Notes Placeholder 2' },
                'p:cNvSpPr': {
                  'a:spLocks': { '@_noGrp': '1' },
                },
                'p:nvPr': {
                  'p:ph': { '@_type': 'body', '@_idx': '1' },
                },
              },
              'p:spPr': '',
              'p:txBody': {
                'a:bodyPr': '',
                'a:lstStyle': '',
                'a:p': textParas,
              },
            },
          ],
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

/**
 * Get file extension without the dot, lowercased.
 */
function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return '';
  return fileName.substring(dot + 1).toLowerCase();
}
