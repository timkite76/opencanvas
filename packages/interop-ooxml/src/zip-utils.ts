import JSZip from 'jszip';

/**
 * Read a zip file from a Uint8Array and return a map of file paths to contents.
 */
export async function readZip(data: Uint8Array): Promise<Map<string, string | Uint8Array>> {
  const zip = await JSZip.loadAsync(data);
  const result = new Map<string, string | Uint8Array>();

  const entries = Object.entries(zip.files);
  for (const [path, file] of entries) {
    if (file.dir) continue;
    // Try to read as text for XML files, binary for others
    const isTextFile =
      path.endsWith('.xml') ||
      path.endsWith('.rels') ||
      path.endsWith('.txt');
    if (isTextFile) {
      const text = await file.async('string');
      result.set(path, text);
    } else {
      const binary = await file.async('uint8array');
      result.set(path, binary);
    }
  }

  return result;
}

/**
 * Write a zip file from a map of file paths to contents.
 */
export async function writeZip(files: Map<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();

  for (const [path, content] of files) {
    zip.file(path, content);
  }

  const buffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return buffer;
}
