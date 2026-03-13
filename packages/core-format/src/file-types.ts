import type { ArtifactType, NativeFileExtension } from '@opencanvas/core-types';

const typeToExtension: Record<ArtifactType, NativeFileExtension> = {
  document: '.ocd',
  workbook: '.ocg',
  presentation: '.ocp',
};

const extensionToType: Record<NativeFileExtension, ArtifactType> = {
  '.ocd': 'document',
  '.ocg': 'workbook',
  '.ocp': 'presentation',
};

export function getExtensionForType(type: ArtifactType): NativeFileExtension {
  return typeToExtension[type];
}

export function getTypeForExtension(ext: NativeFileExtension): ArtifactType {
  return extensionToType[ext];
}
