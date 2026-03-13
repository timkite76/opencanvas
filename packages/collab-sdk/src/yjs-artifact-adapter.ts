import * as Y from 'yjs';
import type { ArtifactEnvelope } from '@opencanvas/core-model';
import type { Operation, BaseNode, ObjectID } from '@opencanvas/core-types';

/**
 * Strategy:
 * - Y.Map("envelope") holds top-level artifact fields (artifactId, title, version, etc.)
 * - Y.Map("nodes") holds all nodes keyed by ObjectID, each node stored as a Y.Map
 *
 * This gives us per-node conflict resolution via Yjs CRDT.
 */

function nodeToYMap(node: BaseNode, ydoc: Y.Doc): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(node)) {
    if (value !== undefined) {
      // For arrays and objects, store as JSON-compatible values
      // Yjs Y.Map handles primitives directly; complex values are stored as-is
      ymap.set(key, structuredClone(value));
    }
  }
  return ymap;
}

function ymapToNode(ymap: Y.Map<unknown>): BaseNode {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of ymap.entries()) {
    obj[key] = value;
  }
  return obj as unknown as BaseNode;
}

export function initFromArtifact(ydoc: Y.Doc, artifact: ArtifactEnvelope): void {
  ydoc.transact(() => {
    const envelope = ydoc.getMap('envelope');
    envelope.set('artifactId', artifact.artifactId);
    envelope.set('title', artifact.title);
    envelope.set('version', structuredClone(artifact.version));
    envelope.set('createdAt', artifact.createdAt);
    envelope.set('updatedAt', artifact.updatedAt);
    envelope.set('artifactType', artifact.artifactType);
    envelope.set('rootNodeId', artifact.rootNodeId);

    if (artifact.assets) envelope.set('assets', structuredClone(artifact.assets));
    if (artifact.comments) envelope.set('comments', structuredClone(artifact.comments));
    if (artifact.agentLog) envelope.set('agentLog', structuredClone(artifact.agentLog));
    if (artifact.permissions) envelope.set('permissions', structuredClone(artifact.permissions));
    if (artifact.references) envelope.set('references', structuredClone(artifact.references));
    if (artifact.styles) envelope.set('styles', structuredClone(artifact.styles));
    if (artifact.themes) envelope.set('themes', structuredClone(artifact.themes));
    if (artifact.customProperties) envelope.set('customProperties', structuredClone(artifact.customProperties));

    const nodesMap = ydoc.getMap('nodes');
    for (const [nodeId, node] of Object.entries(artifact.nodes)) {
      nodesMap.set(nodeId, nodeToYMap(node, ydoc));
    }
  });
}

export function artifactFromYDoc(ydoc: Y.Doc): ArtifactEnvelope {
  const envelope = ydoc.getMap('envelope');
  const nodesMap = ydoc.getMap('nodes');

  const nodes: Record<ObjectID, BaseNode> = {};
  for (const [nodeId, ymap] of nodesMap.entries()) {
    if (ymap instanceof Y.Map) {
      nodes[nodeId] = ymapToNode(ymap);
    }
  }

  const artifact: ArtifactEnvelope = {
    artifactId: (envelope.get('artifactId') as string) ?? '',
    title: (envelope.get('title') as string) ?? '',
    version: (envelope.get('version') as ArtifactEnvelope['version']) ?? { major: 0, minor: 1, patch: 0 },
    createdAt: (envelope.get('createdAt') as string) ?? new Date().toISOString(),
    updatedAt: (envelope.get('updatedAt') as string) ?? new Date().toISOString(),
    artifactType: (envelope.get('artifactType') as ArtifactEnvelope['artifactType']) ?? 'document',
    rootNodeId: (envelope.get('rootNodeId') as string) ?? '',
    nodes,
  };

  const assets = envelope.get('assets');
  if (assets) artifact.assets = assets as ArtifactEnvelope['assets'];
  const comments = envelope.get('comments');
  if (comments) artifact.comments = comments as ArtifactEnvelope['comments'];
  const agentLog = envelope.get('agentLog');
  if (agentLog) artifact.agentLog = agentLog as ArtifactEnvelope['agentLog'];
  const permissions = envelope.get('permissions');
  if (permissions) artifact.permissions = permissions as ArtifactEnvelope['permissions'];
  const references = envelope.get('references');
  if (references) artifact.references = references as ArtifactEnvelope['references'];
  const styles = envelope.get('styles');
  if (styles) artifact.styles = styles as ArtifactEnvelope['styles'];
  const themes = envelope.get('themes');
  if (themes) artifact.themes = themes as ArtifactEnvelope['themes'];
  const customProperties = envelope.get('customProperties');
  if (customProperties) artifact.customProperties = customProperties as ArtifactEnvelope['customProperties'];

  return artifact;
}

export function applyOperationToYDoc(ydoc: Y.Doc, op: Operation): void {
  ydoc.transact(() => {
    const nodesMap = ydoc.getMap('nodes');
    const envelope = ydoc.getMap('envelope');

    switch (op.type) {
      case 'insert_node': {
        const { node, parentId, index } = op.payload;
        const ynode = nodeToYMap({ ...node, parentId } as BaseNode, ydoc);
        nodesMap.set(op.targetId, ynode);

        // Update parent's childIds
        const parentYMap = nodesMap.get(parentId) as Y.Map<unknown> | undefined;
        if (parentYMap) {
          const childIds = (parentYMap.get('childIds') as string[] | undefined) ?? [];
          const newChildIds = [...childIds];
          if (index !== undefined && index >= 0 && index <= newChildIds.length) {
            newChildIds.splice(index, 0, op.targetId);
          } else {
            newChildIds.push(op.targetId);
          }
          parentYMap.set('childIds', newChildIds);
        }
        break;
      }

      case 'delete_node': {
        const nodeYMap = nodesMap.get(op.targetId) as Y.Map<unknown> | undefined;
        if (nodeYMap) {
          const parentId = nodeYMap.get('parentId') as string | undefined;
          if (parentId) {
            const parentYMap = nodesMap.get(parentId) as Y.Map<unknown> | undefined;
            if (parentYMap) {
              const childIds = (parentYMap.get('childIds') as string[] | undefined) ?? [];
              parentYMap.set('childIds', childIds.filter((id: string) => id !== op.targetId));
            }
          }
        }
        nodesMap.delete(op.targetId);
        break;
      }

      case 'update_node': {
        const nodeYMap = nodesMap.get(op.targetId) as Y.Map<unknown> | undefined;
        if (nodeYMap) {
          for (const [key, value] of Object.entries(op.payload.patch)) {
            nodeYMap.set(key, structuredClone(value));
          }
        }
        break;
      }

      case 'move_node': {
        const nodeYMap = nodesMap.get(op.targetId) as Y.Map<unknown> | undefined;
        if (!nodeYMap) break;

        const oldParentId = nodeYMap.get('parentId') as string | undefined;
        const { newParentId, index } = op.payload;

        // Remove from old parent
        if (oldParentId) {
          const oldParentYMap = nodesMap.get(oldParentId) as Y.Map<unknown> | undefined;
          if (oldParentYMap) {
            const childIds = (oldParentYMap.get('childIds') as string[] | undefined) ?? [];
            oldParentYMap.set('childIds', childIds.filter((id: string) => id !== op.targetId));
          }
        }

        // Add to new parent
        const newParentYMap = nodesMap.get(newParentId) as Y.Map<unknown> | undefined;
        if (newParentYMap) {
          const childIds = (newParentYMap.get('childIds') as string[] | undefined) ?? [];
          const newChildIds = [...childIds];
          if (index !== undefined && index >= 0 && index <= newChildIds.length) {
            newChildIds.splice(index, 0, op.targetId);
          } else {
            newChildIds.push(op.targetId);
          }
          newParentYMap.set('childIds', newChildIds);
        }

        nodeYMap.set('parentId', newParentId);
        break;
      }

      case 'replace_text': {
        const nodeYMap = nodesMap.get(op.targetId) as Y.Map<unknown> | undefined;
        if (!nodeYMap) break;

        const content = nodeYMap.get('content') as Array<{ text: string; [k: string]: unknown }> | undefined;
        if (!content || content.length === 0) break;

        const { startOffset, endOffset, newText } = op.payload;
        // Rebuild text across runs, apply replacement, store back as single run with new text
        const fullText = content.map((r) => r.text).join('');
        const replaced = fullText.substring(0, startOffset) + newText + fullText.substring(endOffset);
        // Preserve first run's formatting, update text
        const newContent = [{ ...content[0], text: replaced }];
        nodeYMap.set('content', newContent);
        break;
      }

      case 'set_formula': {
        const nodeYMap = nodesMap.get(op.targetId) as Y.Map<unknown> | undefined;
        if (nodeYMap) {
          nodeYMap.set('formula', op.payload.formula);
        }
        break;
      }

      case 'set_cell_value': {
        const nodeYMap = nodesMap.get(op.targetId) as Y.Map<unknown> | undefined;
        if (nodeYMap) {
          nodeYMap.set('rawValue', op.payload.rawValue);
        }
        break;
      }

      case 'move_object': {
        const nodeYMap = nodesMap.get(op.targetId) as Y.Map<unknown> | undefined;
        if (nodeYMap) {
          nodeYMap.set('x', op.payload.x);
          nodeYMap.set('y', op.payload.y);
        }
        break;
      }

      case 'resize_object': {
        const nodeYMap = nodesMap.get(op.targetId) as Y.Map<unknown> | undefined;
        if (nodeYMap) {
          nodeYMap.set('width', op.payload.width);
          nodeYMap.set('height', op.payload.height);
        }
        break;
      }

      case 'apply_theme': {
        envelope.set('activeThemeId', op.payload.themeId);
        break;
      }

      case 'batch': {
        for (const childOp of op.payload.operations) {
          applyOperationToYDoc(ydoc, childOp);
        }
        break;
      }
    }

    envelope.set('updatedAt', op.timestamp);
  });
}

export function observeYDoc(ydoc: Y.Doc, callback: (artifact: ArtifactEnvelope) => void): () => void {
  const handler = (_events: Y.YEvent<Y.Map<unknown>>[], transaction: Y.Transaction) => {
    // Only react to remote changes
    if (transaction.local) return;
    callback(artifactFromYDoc(ydoc));
  };

  const nodesMap = ydoc.getMap('nodes');
  const envelope = ydoc.getMap('envelope');

  nodesMap.observeDeep(handler);
  envelope.observeDeep(handler);

  return () => {
    nodesMap.unobserveDeep(handler);
    envelope.unobserveDeep(handler);
  };
}
