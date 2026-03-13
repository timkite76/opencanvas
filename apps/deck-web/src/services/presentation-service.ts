import type { Operation } from '@opencanvas/core-types';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { DeckNode } from '@opencanvas/deck-model';
import { buildSlideIndex, type SlideIndex } from '@opencanvas/deck-model';
import { applyOperation } from '@opencanvas/core-ops';
import { serializeArtifact } from '@opencanvas/core-format';
import { SAMPLE_DECK } from '../sample-data/sample-deck.js';

export interface PresentationService {
  open(): ArtifactEnvelope<DeckNode>;
  save(artifact: ArtifactEnvelope<DeckNode>): void;
  getSlideIndex(artifact: ArtifactEnvelope<DeckNode>): SlideIndex;
  applyOp(artifact: ArtifactEnvelope<DeckNode>, op: Operation): ArtifactEnvelope<DeckNode>;
}

export function createPresentationService(): PresentationService {
  return {
    open(): ArtifactEnvelope<DeckNode> {
      return SAMPLE_DECK;
    },

    save(artifact: ArtifactEnvelope<DeckNode>): void {
      const serialized = serializeArtifact(artifact as ArtifactEnvelope);
      console.log('[presentation-service] save', {
        artifactId: artifact.artifactId,
        nodeCount: Object.keys(artifact.nodes).length,
        files: Object.keys(serialized.files),
      });
    },

    getSlideIndex(artifact: ArtifactEnvelope<DeckNode>): SlideIndex {
      return buildSlideIndex(artifact.nodes, artifact.rootNodeId);
    },

    applyOp(artifact: ArtifactEnvelope<DeckNode>, op: Operation): ArtifactEnvelope<DeckNode> {
      return applyOperation(artifact as ArtifactEnvelope, op) as ArtifactEnvelope<DeckNode>;
    },
  };
}
