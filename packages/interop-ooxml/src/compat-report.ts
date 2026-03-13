/**
 * Tracks what was preserved, approximated, unsupported, or omitted
 * during an OOXML import or export operation.
 */
export interface CompatibilityReport {
  /** Features that were fully preserved in the conversion */
  preserved: string[];
  /** Features that were converted with some loss of fidelity */
  approximated: string[];
  /** Features present in the source that are not supported and were skipped */
  unsupported: string[];
  /** Features that were intentionally omitted (e.g. metadata, revision history) */
  omitted: string[];
}

/**
 * Helper to create an empty CompatibilityReport.
 */
export function createCompatReport(): CompatibilityReport {
  return {
    preserved: [],
    approximated: [],
    unsupported: [],
    omitted: [],
  };
}

/**
 * Helper to add a unique entry to a report category.
 */
export function addReportEntry(
  report: CompatibilityReport,
  category: keyof CompatibilityReport,
  entry: string,
): void {
  if (!report[category].includes(entry)) {
    report[category].push(entry);
  }
}
