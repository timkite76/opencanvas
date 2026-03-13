import { v4 as uuidv4 } from 'uuid';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode, CellNode, CellValueType } from '@opencanvas/grid-model';
import { columnIndexToLabel } from '@opencanvas/grid-model';
import {
  readZip,
  parseXml,
  parseRelationships,
  type CompatibilityReport,
  createCompatReport,
  addReportEntry,
} from '@opencanvas/interop-ooxml';

export async function importXlsx(
  data: Uint8Array,
): Promise<{ artifact: ArtifactEnvelope<GridNode>; report: CompatibilityReport }> {
  const zipFiles = await readZip(data);
  const report = createCompatReport();

  // Parse shared strings
  const sharedStrings = parseSharedStrings(zipFiles, report);

  // Parse workbook.xml for sheet names
  const workbookXml = zipFiles.get('xl/workbook.xml');
  if (!workbookXml || typeof workbookXml !== 'string') {
    throw new Error('Invalid XLSX: missing xl/workbook.xml');
  }

  const workbookParsed = parseXml(workbookXml) as Record<string, unknown>;
  const workbook = workbookParsed['workbook'] as Record<string, unknown> | undefined;
  if (!workbook) {
    throw new Error('Invalid XLSX: missing workbook element');
  }

  const sheets = workbook['sheets'] as Record<string, unknown> | undefined;
  const sheetEntries = ensureArray(sheets?.['sheet']);

  // Parse workbook relationships to find sheet file paths
  const wbRelsXml = zipFiles.get('xl/_rels/workbook.xml.rels');
  const wbRels = wbRelsXml && typeof wbRelsXml === 'string'
    ? parseRelationships(wbRelsXml)
    : [];

  const rIdToTarget = new Map<string, string>();
  for (const rel of wbRels) {
    rIdToTarget.set(rel.id, rel.target);
  }

  const nodes: Record<string, GridNode> = {};
  const workbookId = uuidv4();
  const worksheetIds: string[] = [];

  for (const entry of sheetEntries) {
    const sheet = entry as Record<string, unknown>;
    const sheetName = (sheet['@_name'] as string) ?? 'Sheet';
    const rId = (sheet['@_r:id'] as string) ?? '';

    // Resolve the sheet file path
    let sheetPath = rIdToTarget.get(rId);
    if (sheetPath) {
      // Paths in rels are relative to xl/
      if (!sheetPath.startsWith('/')) {
        sheetPath = 'xl/' + sheetPath;
      } else {
        sheetPath = sheetPath.substring(1);
      }
    } else {
      // Fallback: try numbered sheet paths
      const idx = worksheetIds.length + 1;
      sheetPath = `xl/worksheets/sheet${idx}.xml`;
    }

    const sheetXml = zipFiles.get(sheetPath);
    if (!sheetXml || typeof sheetXml !== 'string') {
      continue;
    }

    const worksheetId = uuidv4();
    worksheetIds.push(worksheetId);

    const { cellNodes, maxRow, maxCol } = parseWorksheet(
      sheetXml,
      sharedStrings,
      worksheetId,
      report,
    );

    // Register cell nodes
    const cellIds: string[] = [];
    for (const cell of cellNodes) {
      nodes[cell.id] = cell;
      cellIds.push(cell.id);
    }

    const worksheetNode: GridNode = {
      id: worksheetId,
      type: 'worksheet',
      name: sheetName,
      columnCount: maxCol,
      rowCount: maxRow,
      parentId: workbookId,
      childIds: cellIds,
    };
    nodes[worksheetId] = worksheetNode;
    addReportEntry(report, 'preserved', `worksheet: ${sheetName}`);
  }

  // Build workbook node
  const workbookNode: GridNode = {
    id: workbookId,
    type: 'workbook',
    title: 'Imported Workbook',
    childIds: worksheetIds,
  };
  nodes[workbookId] = workbookNode;

  // Check for unsupported features
  for (const [path] of zipFiles) {
    if (path.includes('chart')) {
      addReportEntry(report, 'unsupported', 'charts');
    }
    if (path.includes('pivotTable') || path.includes('pivotCache')) {
      addReportEntry(report, 'unsupported', 'pivot tables');
    }
    if (path.endsWith('.vba') || path.endsWith('.bin') || path.includes('vbaProject')) {
      addReportEntry(report, 'unsupported', 'macros (VBA)');
    }
    if (path.includes('conditionalFormatting') || path === 'xl/styles.xml') {
      // styles.xml contains conditional formatting rules among other things
      addReportEntry(report, 'approximated', 'cell styles and conditional formatting');
    }
  }

  const now = new Date().toISOString();
  const artifact: ArtifactEnvelope<GridNode> = {
    artifactId: uuidv4(),
    artifactType: 'workbook',
    title: 'Imported Workbook',
    version: { major: 1, minor: 0, patch: 0 },
    createdAt: now,
    updatedAt: now,
    rootNodeId: workbookId,
    nodes,
  };

  return { artifact, report };
}

function parseSharedStrings(
  zipFiles: Map<string, string | Uint8Array>,
  report: CompatibilityReport,
): string[] {
  const ssXml = zipFiles.get('xl/sharedStrings.xml');
  if (!ssXml || typeof ssXml !== 'string') return [];

  const parsed = parseXml(ssXml) as Record<string, unknown>;
  const sst = parsed['sst'] as Record<string, unknown> | undefined;
  if (!sst) return [];

  const siEntries = ensureArray(sst['si']);
  const strings: string[] = [];

  for (const si of siEntries) {
    const entry = si as Record<string, unknown>;
    // Simple case: <si><t>text</t></si>
    const t = entry['t'];
    if (t !== undefined) {
      if (typeof t === 'string') {
        strings.push(t);
      } else if (typeof t === 'number') {
        strings.push(String(t));
      } else if (t && typeof t === 'object') {
        const textObj = t as Record<string, unknown>;
        const text = textObj['#text'];
        strings.push(typeof text === 'string' ? text : typeof text === 'number' ? String(text) : '');
      } else {
        strings.push('');
      }
      continue;
    }

    // Rich text case: <si><r><t>text</t></r>...</si>
    const rEntries = ensureArray(entry['r']);
    let fullText = '';
    for (const r of rEntries) {
      const rObj = r as Record<string, unknown>;
      const rText = rObj['t'];
      if (typeof rText === 'string') {
        fullText += rText;
      } else if (typeof rText === 'number') {
        fullText += String(rText);
      } else if (rText && typeof rText === 'object') {
        const textObj = rText as Record<string, unknown>;
        const text = textObj['#text'];
        fullText += typeof text === 'string' ? text : typeof text === 'number' ? String(text) : '';
      }
    }
    strings.push(fullText);
    if (rEntries.length > 0) {
      addReportEntry(report, 'approximated', 'rich text in cells (formatting stripped)');
    }
  }

  return strings;
}

function parseWorksheet(
  xml: string,
  sharedStrings: string[],
  worksheetId: string,
  report: CompatibilityReport,
): { cellNodes: CellNode[]; maxRow: number; maxCol: number } {
  const parsed = parseXml(xml) as Record<string, unknown>;
  const worksheet = parsed['worksheet'] as Record<string, unknown> | undefined;
  if (!worksheet) return { cellNodes: [], maxRow: 0, maxCol: 0 };

  const sheetData = worksheet['sheetData'] as Record<string, unknown> | undefined;
  if (!sheetData) return { cellNodes: [], maxRow: 0, maxCol: 0 };

  const rows = ensureArray(sheetData['row']);
  const cellNodes: CellNode[] = [];
  let maxRow = 0;
  let maxCol = 0;

  for (const rowEl of rows) {
    const row = rowEl as Record<string, unknown>;
    const rowNum = parseInt(String(row['@_r'] ?? '0'), 10);
    if (rowNum > maxRow) maxRow = rowNum;

    const cells = ensureArray(row['c']);
    for (const cellEl of cells) {
      const cell = cellEl as Record<string, unknown>;
      const address = (cell['@_r'] as string) ?? '';
      const cellType = (cell['@_t'] as string) ?? '';
      const rawV = cell['v'];
      const formula = cell['f'];

      let rawValue: string | number | boolean | null = null;
      let displayValue = '';
      let valueType: CellValueType = 'empty';

      if (cellType === 's') {
        // Shared string reference
        const idx = parseInt(String(rawV ?? '0'), 10);
        rawValue = sharedStrings[idx] ?? '';
        displayValue = rawValue as string;
        valueType = 'string';
        addReportEntry(report, 'preserved', 'string cell values');
      } else if (cellType === 'b') {
        // Boolean
        rawValue = rawV === '1' || rawV === 1 || rawV === true;
        displayValue = rawValue ? 'TRUE' : 'FALSE';
        valueType = 'boolean';
        addReportEntry(report, 'preserved', 'boolean cell values');
      } else if (cellType === 'e') {
        // Error
        rawValue = typeof rawV === 'string' ? rawV : String(rawV ?? '#ERROR!');
        displayValue = rawValue as string;
        valueType = 'error';
      } else if (cellType === 'str' || cellType === 'inlineStr') {
        // Inline string
        rawValue = typeof rawV === 'string' ? rawV : String(rawV ?? '');
        displayValue = rawValue as string;
        valueType = 'string';
      } else {
        // Number (default) or empty
        if (rawV !== undefined && rawV !== null && rawV !== '') {
          const numVal = typeof rawV === 'number' ? rawV : parseFloat(String(rawV));
          if (!isNaN(numVal)) {
            rawValue = numVal;
            displayValue = String(numVal);
            valueType = 'number';
            addReportEntry(report, 'preserved', 'numeric cell values');
          } else {
            rawValue = String(rawV);
            displayValue = rawValue;
            valueType = 'string';
          }
        }
      }

      let formulaStr: string | null = null;
      if (formula !== undefined && formula !== null) {
        if (typeof formula === 'string') {
          formulaStr = '=' + formula;
        } else if (typeof formula === 'object') {
          const fObj = formula as Record<string, unknown>;
          const fText = fObj['#text'];
          if (typeof fText === 'string') {
            formulaStr = '=' + fText;
          }
        }
        addReportEntry(report, 'preserved', 'formulas (text only, not evaluated)');
      }

      // Skip truly empty cells
      if (valueType === 'empty' && !formulaStr) continue;

      // Calculate column index for maxCol
      const colMatch = address.match(/^([A-Z]+)/);
      if (colMatch) {
        let colIdx = 0;
        for (let i = 0; i < colMatch[1].length; i++) {
          colIdx = colIdx * 26 + (colMatch[1].charCodeAt(i) - 64);
        }
        if (colIdx > maxCol) maxCol = colIdx;
      }

      const cellNode: CellNode = {
        id: uuidv4(),
        type: 'cell',
        address,
        rawValue,
        formula: formulaStr,
        displayValue,
        valueType,
        parentId: worksheetId,
      };
      cellNodes.push(cellNode);
    }
  }

  // Check for merge cells
  if (worksheet['mergeCells']) {
    addReportEntry(report, 'unsupported', 'merged cells');
  }

  // Check for conditional formatting
  if (worksheet['conditionalFormatting']) {
    addReportEntry(report, 'unsupported', 'conditional formatting');
  }

  // Check for data validations
  if (worksheet['dataValidations']) {
    addReportEntry(report, 'unsupported', 'data validations');
  }

  return { cellNodes, maxRow, maxCol };
}

function ensureArray(val: unknown): unknown[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}
