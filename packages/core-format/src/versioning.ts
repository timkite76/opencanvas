export const OPEN_CANVAS_FORMAT_NAME = 'OpenCanvas';
export const CURRENT_FORMAT_VERSION = '0.1.0';

export function assertSupportedFormatVersion(version: string): void {
  if (version !== CURRENT_FORMAT_VERSION) {
    throw new Error(
      `Unsupported format version "${version}". Expected "${CURRENT_FORMAT_VERSION}"`,
    );
  }
}
