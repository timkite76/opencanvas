import type { ArtifactEnvelope } from '@opencanvas/core-model';

export const SAMPLE_OCD_FILES: Record<string, string> = {
  'manifest.json': JSON.stringify({
    format: 'OpenCanvas',
    artifactType: 'document',
    version: '0.1.0',
    entry: 'artifact.json',
    nodeIndex: 'nodes/nodes.json',
    styleIndex: 'styles/styles.json',
    themeIndex: 'themes/themes.json',
    commentsIndex: 'comments/comments.json',
    agentLogIndex: 'agent/action-log.json',
    referencesIndex: 'references/references.json',
    assetIndex: 'assets/asset-index.json',
    customPropertiesIndex: 'metadata/custom-properties.json',
  }),
  'artifact.json': JSON.stringify({
    artifactId: 'doc-001',
    artifactType: 'document',
    title: 'Product Requirements Document',
    version: { major: 0, minor: 1, patch: 0 },
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
    rootNodeId: 'root',
  }),
  'nodes/nodes.json': JSON.stringify({
    root: {
      id: 'root',
      type: 'document',
      childIds: ['section-1'],
    },
    'section-1': {
      id: 'section-1',
      type: 'section',
      parentId: 'root',
      title: 'Overview',
      childIds: ['heading-1', 'para-1', 'heading-2', 'para-2', 'para-3'],
    },
    'heading-1': {
      id: 'heading-1',
      type: 'heading',
      parentId: 'section-1',
      level: 1,
      content: [{ text: 'Product Requirements Document' }],
    },
    'para-1': {
      id: 'para-1',
      type: 'paragraph',
      parentId: 'section-1',
      content: [
        {
          text: 'This document outlines the core requirements for the OpenCanvas productivity suite. The suite includes three AI-native editors for documents, spreadsheets, and presentations. Each editor operates on a canonical internal model with structured operations that support both human editing and AI-assisted workflows.',
        },
      ],
    },
    'heading-2': {
      id: 'heading-2',
      type: 'heading',
      parentId: 'section-1',
      level: 2,
      content: [{ text: 'Goals and Objectives' }],
    },
    'para-2': {
      id: 'para-2',
      type: 'paragraph',
      parentId: 'section-1',
      content: [
        {
          text: 'The primary goal is to deliver an open-source office suite where AI is a first-class collaborator, not a bolt-on feature. Every artifact should be structured, machine-operable, and human-readable. The suite must support local, self-hosted, cloud, and enterprise deployment models.',
        },
      ],
    },
    'para-3': {
      id: 'para-3',
      type: 'paragraph',
      parentId: 'section-1',
      content: [
        {
          text: 'Success will be measured by adoption rates, AI usage acceptance, import/export fidelity, formula correctness, rendering consistency, and the growth of both contributors and the plugin ecosystem.',
        },
      ],
    },
  }),
  'styles/styles.json': '[]',
  'themes/themes.json': '[]',
  'comments/comments.json': '[]',
  'agent/action-log.json': '[]',
  'references/references.json': '[]',
  'assets/asset-index.json': '[]',
  'metadata/custom-properties.json': '{}',
};
