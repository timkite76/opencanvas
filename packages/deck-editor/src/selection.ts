import type { ObjectID } from '@opencanvas/core-types';

export interface DeckSelection {
  slideId: ObjectID;
  objectId?: ObjectID;
}

export function isSlideSelected(selection: DeckSelection | null): boolean {
  return selection !== null && selection.slideId !== undefined;
}

export function isObjectSelected(selection: DeckSelection | null): boolean {
  return selection !== null && selection.objectId !== undefined;
}

export function selectSlide(slideId: ObjectID): DeckSelection {
  return { slideId };
}

export function selectObject(slideId: ObjectID, objectId: ObjectID): DeckSelection {
  return { slideId, objectId };
}

export function clearObjectSelection(selection: DeckSelection): DeckSelection {
  return { slideId: selection.slideId };
}
