import type { ObjectID, BaseNode } from '@opencanvas/core-types';
import type {
  PresentationNode,
  SlideNode,
  TextBoxNode,
  ImageObjectNode,
  ShapeNode,
  SpeakerNotesNode,
  DeckNode,
} from './types.js';

export interface SlideIndex {
  slideById: Record<ObjectID, SlideNode>;
  objectIdsBySlideId: Record<ObjectID, ObjectID[]>;
  notesBySlideId: Record<ObjectID, SpeakerNotesNode | undefined>;
}

export function buildSlideIndex(
  nodes: Record<ObjectID, BaseNode>,
  rootNodeId: ObjectID,
): SlideIndex {
  const slideById: Record<ObjectID, SlideNode> = {};
  const objectIdsBySlideId: Record<ObjectID, ObjectID[]> = {};
  const notesBySlideId: Record<ObjectID, SpeakerNotesNode | undefined> = {};

  const root = nodes[rootNodeId] as PresentationNode | undefined;
  if (!root || root.type !== 'presentation') {
    return { slideById, objectIdsBySlideId, notesBySlideId };
  }

  const slideIds = root.childIds ?? [];

  for (const slideId of slideIds) {
    const slide = nodes[slideId] as DeckNode | undefined;
    if (!slide || slide.type !== 'slide') continue;

    const slideNode = slide as SlideNode;
    slideById[slideId] = slideNode;

    const objectIds: ObjectID[] = [];
    const childIds = slideNode.childIds ?? [];

    for (const childId of childIds) {
      const child = nodes[childId] as DeckNode | undefined;
      if (!child) continue;

      if (child.type === 'speaker_notes') {
        notesBySlideId[slideId] = child as SpeakerNotesNode;
      } else {
        objectIds.push(childId);
      }
    }

    objectIdsBySlideId[slideId] = objectIds;

    if (!(slideId in notesBySlideId)) {
      notesBySlideId[slideId] = undefined;
    }
  }

  return { slideById, objectIdsBySlideId, notesBySlideId };
}
