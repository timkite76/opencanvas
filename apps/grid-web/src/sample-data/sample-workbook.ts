import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { GridNode } from '@opencanvas/grid-model';

/**
 * Sample .ocg fixture: a workbook with one worksheet, cells A1-A3 with numbers,
 * and B1 with =SUM(A1:A3).
 */
export const SAMPLE_WORKBOOK: ArtifactEnvelope<GridNode> = {
  artifactId: 'workbook-001',
  title: 'Sample Workbook',
  version: { major: 0, minor: 1, patch: 0 },
  createdAt: '2026-03-13T00:00:00.000Z',
  updatedAt: '2026-03-13T00:00:00.000Z',
  artifactType: 'workbook',
  rootNodeId: 'wb-root',
  nodes: {
    'wb-root': {
      id: 'wb-root',
      type: 'workbook',
      title: 'Sample Workbook',
      childIds: ['ws-1'],
    } as GridNode,
    'ws-1': {
      id: 'ws-1',
      type: 'worksheet',
      parentId: 'wb-root',
      name: 'Sheet1',
      columnCount: 26,
      rowCount: 100,
      childIds: ['cell-a1', 'cell-a2', 'cell-a3', 'cell-b1'],
    } as GridNode,
    'cell-a1': {
      id: 'cell-a1',
      type: 'cell',
      parentId: 'ws-1',
      address: 'A1',
      rawValue: 10,
      formula: null,
      displayValue: '10',
      valueType: 'number',
    } as GridNode,
    'cell-a2': {
      id: 'cell-a2',
      type: 'cell',
      parentId: 'ws-1',
      address: 'A2',
      rawValue: 20,
      formula: null,
      displayValue: '20',
      valueType: 'number',
    } as GridNode,
    'cell-a3': {
      id: 'cell-a3',
      type: 'cell',
      parentId: 'ws-1',
      address: 'A3',
      rawValue: 30,
      formula: null,
      displayValue: '30',
      valueType: 'number',
    } as GridNode,
    'cell-b1': {
      id: 'cell-b1',
      type: 'cell',
      parentId: 'ws-1',
      address: 'B1',
      rawValue: null,
      formula: '=SUM(A1:A3)',
      displayValue: '',
      valueType: 'empty',
    } as GridNode,
  },
};
