import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode, CellNode } from '@opencanvas/grid-model';
import {
  writeZip,
  buildXml,
  buildContentTypes,
  buildRelationships,
  type CompatibilityReport,
  createCompatReport,
  addReportEntry,
} from '@opencanvas/interop-ooxml';

export async function exportXlsx(
  artifact: ArtifactEnvelope,
): Promise<{ data: Uint8Array; report: CompatibilityReport }> {
  const report = createCompatReport();
  const nodes = artifact.nodes as Record<string, GridNode>;
  const rootNode = nodes[artifact.rootNodeId];

  if (!rootNode || rootNode.type !== 'workbook') {
    throw new Error('Root node must be a workbook');
  }

  const worksheetIds = rootNode.childIds ?? [];
  const sharedStrings: string[] = [];
  const sharedStringIndex = new Map<string, number>();

  function getSharedStringIdx(s: string): number {
    const existing = sharedStringIndex.get(s);
    if (existing !== undefined) return existing;
    const idx = sharedStrings.length;
    sharedStrings.push(s);
    sharedStringIndex.set(s, idx);
    return idx;
  }

  const files = new Map<string, string | Uint8Array>();
  const sheetRels: { id: string; name: string; target: string }[] = [];

  for (let i = 0; i < worksheetIds.length; i++) {
    const wsNode = nodes[worksheetIds[i]];
    if (!wsNode || wsNode.type !== 'worksheet') continue;

    const worksheet = wsNode as GridNode & { type: 'worksheet'; name: string };
    const cellIds = wsNode.childIds ?? [];

    // Group cells by row
    const rowMap = new Map<number, unknown[]>();
    for (const cellId of cellIds) {
      const cellNode = nodes[cellId] as CellNode | undefined;
      if (!cellNode || cellNode.type !== 'cell') continue;

      const rowNum = parseRowFromAddress(cellNode.address);
      if (!rowMap.has(rowNum)) {
        rowMap.set(rowNum, []);
      }

      const cellXml = buildCellXml(cellNode, getSharedStringIdx, report);
      rowMap.get(rowNum)!.push(cellXml);
    }

    // Build rows sorted by row number
    const sortedRows = Array.from(rowMap.entries()).sort(([a], [b]) => a - b);
    const rows = sortedRows.map(([rowNum, cells]) => ({
      '@_r': String(rowNum),
      c: cells,
    }));

    const sheetXml = buildXml({
      worksheet: {
        '@_xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        '@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        sheetData: {
          row: rows,
        },
      },
    });

    const sheetIdx = i + 1;
    const sheetPath = `xl/worksheets/sheet${sheetIdx}.xml`;
    files.set(sheetPath, sheetXml);

    sheetRels.push({
      id: `rId${sheetIdx}`,
      name: worksheet.name,
      target: `worksheets/sheet${sheetIdx}.xml`,
    });

    addReportEntry(report, 'preserved', `worksheet: ${worksheet.name}`);
  }

  // Build shared strings
  if (sharedStrings.length > 0) {
    const siEntries = sharedStrings.map((s) => ({ t: { '#text': s, '@_xml:space': 'preserve' } }));
    const ssXml = buildXml({
      sst: {
        '@_xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        '@_count': String(sharedStrings.length),
        '@_uniqueCount': String(sharedStrings.length),
        si: siEntries,
      },
    });
    files.set('xl/sharedStrings.xml', ssXml);
  }

  // Build workbook.xml
  const sheetElements = sheetRels.map((s, idx) => ({
    '@_name': s.name,
    '@_sheetId': String(idx + 1),
    '@_r:id': s.id,
  }));

  const workbookXml = buildXml({
    workbook: {
      '@_xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      '@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      sheets: {
        sheet: sheetElements,
      },
    },
  });
  files.set('xl/workbook.xml', workbookXml);

  // Build workbook relationships
  const wbRelEntries = sheetRels.map((s) => ({
    id: s.id,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
    target: s.target,
  }));

  if (sharedStrings.length > 0) {
    wbRelEntries.push({
      id: `rId${sheetRels.length + 1}`,
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings',
      target: 'sharedStrings.xml',
    });
  }

  files.set('xl/_rels/workbook.xml.rels', buildRelationships(wbRelEntries));

  // Build root relationships
  files.set(
    '_rels/.rels',
    buildRelationships([
      {
        id: 'rId1',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
        target: 'xl/workbook.xml',
      },
    ]),
  );

  // Build content types
  const overrides = [
    {
      partName: '/xl/workbook.xml',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    },
    ...sheetRels.map((_, idx) => ({
      partName: `/xl/worksheets/sheet${idx + 1}.xml`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
    })),
  ];

  if (sharedStrings.length > 0) {
    overrides.push({
      partName: '/xl/sharedStrings.xml',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml',
    });
  }

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

function buildCellXml(
  cell: CellNode,
  getSharedStringIdx: (s: string) => number,
  report: CompatibilityReport,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    '@_r': cell.address,
  };

  // Handle formula
  if (cell.formula) {
    const formulaText = cell.formula.startsWith('=') ? cell.formula.substring(1) : cell.formula;
    result['f'] = { '#text': formulaText };
    addReportEntry(report, 'preserved', 'formulas');
  }

  switch (cell.valueType) {
    case 'string': {
      const strVal = typeof cell.rawValue === 'string' ? cell.rawValue : String(cell.rawValue ?? '');
      const idx = getSharedStringIdx(strVal);
      result['@_t'] = 's';
      result['v'] = { '#text': String(idx) };
      addReportEntry(report, 'preserved', 'string cell values');
      break;
    }
    case 'number': {
      result['v'] = { '#text': String(cell.rawValue ?? 0) };
      addReportEntry(report, 'preserved', 'numeric cell values');
      break;
    }
    case 'boolean': {
      result['@_t'] = 'b';
      result['v'] = { '#text': cell.rawValue ? '1' : '0' };
      addReportEntry(report, 'preserved', 'boolean cell values');
      break;
    }
    case 'error': {
      result['@_t'] = 'e';
      result['v'] = { '#text': String(cell.rawValue ?? '#ERROR!') };
      break;
    }
    case 'empty':
    default:
      break;
  }

  return result;
}

function parseRowFromAddress(address: string): number {
  const match = address.match(/\d+$/);
  return match ? parseInt(match[0], 10) : 1;
}
