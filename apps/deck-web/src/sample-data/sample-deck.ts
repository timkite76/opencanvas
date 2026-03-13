import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode } from '@opencanvas/deck-model';

const PRESENTATION_ID = 'pres-root-001';
const SLIDE_1_ID = 'slide-001';
const SLIDE_2_ID = 'slide-002';
const TITLE_BOX_1_ID = 'textbox-s1-title';
const BODY_BOX_1_ID = 'textbox-s1-body';
const TITLE_BOX_2_ID = 'textbox-s2-title';
const BODY_BOX_2_ID = 'textbox-s2-body';
const NOTES_1_ID = 'notes-s1';

export const SAMPLE_DECK: ArtifactEnvelope<DeckNode> = {
  artifactId: 'deck-sample-001',
  artifactType: 'presentation',
  title: 'OpenCanvas Overview',
  version: { major: 0, minor: 1, patch: 0 },
  createdAt: '2026-03-13T00:00:00.000Z',
  updatedAt: '2026-03-13T00:00:00.000Z',
  rootNodeId: PRESENTATION_ID,
  nodes: {
    [PRESENTATION_ID]: {
      id: PRESENTATION_ID,
      type: 'presentation',
      childIds: [SLIDE_1_ID, SLIDE_2_ID],
    },
    [SLIDE_1_ID]: {
      id: SLIDE_1_ID,
      type: 'slide',
      parentId: PRESENTATION_ID,
      childIds: [TITLE_BOX_1_ID, BODY_BOX_1_ID, NOTES_1_ID],
    },
    [SLIDE_2_ID]: {
      id: SLIDE_2_ID,
      type: 'slide',
      parentId: PRESENTATION_ID,
      childIds: [TITLE_BOX_2_ID, BODY_BOX_2_ID],
    },
    [TITLE_BOX_1_ID]: {
      id: TITLE_BOX_1_ID,
      type: 'textbox',
      parentId: SLIDE_1_ID,
      x: 60,
      y: 40,
      width: 840,
      height: 80,
      content: [{ text: 'OpenCanvas Overview', bold: true, fontSize: 36 }],
    },
    [BODY_BOX_1_ID]: {
      id: BODY_BOX_1_ID,
      type: 'textbox',
      parentId: SLIDE_1_ID,
      x: 60,
      y: 150,
      width: 840,
      height: 340,
      content: [{ text: 'An AI-native productivity suite for documents, spreadsheets, and presentations.', fontSize: 20 }],
    },
    [NOTES_1_ID]: {
      id: NOTES_1_ID,
      type: 'speaker_notes',
      parentId: SLIDE_1_ID,
      content: [{ text: 'Welcome the audience and introduce the OpenCanvas platform. Highlight the AI-native approach.' }],
    },
    [TITLE_BOX_2_ID]: {
      id: TITLE_BOX_2_ID,
      type: 'textbox',
      parentId: SLIDE_2_ID,
      x: 60,
      y: 40,
      width: 840,
      height: 80,
      content: [{ text: 'Key Features', bold: true, fontSize: 36 }],
    },
    [BODY_BOX_2_ID]: {
      id: BODY_BOX_2_ID,
      type: 'textbox',
      parentId: SLIDE_2_ID,
      x: 60,
      y: 150,
      width: 840,
      height: 340,
      content: [{ text: 'Document editing, spreadsheets, presentations, and AI-powered assistance across all formats.', fontSize: 20 }],
    },
  } as Record<string, DeckNode>,
};
