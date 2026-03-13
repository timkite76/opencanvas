/**
 * Function Marketplace skeleton.
 *
 * Provides a categorized, searchable listing of all registered AI functions.
 */

import type { RegisteredFunction } from '@opencanvas/function-sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FunctionCategory =
  | 'writing'
  | 'analysis'
  | 'formatting'
  | 'generation'
  | 'review'
  | 'transform';

export interface MarketplaceEntry {
  function: RegisteredFunction;
  category: FunctionCategory;
  author: string;
  version: string;
  downloads: number;
  rating: number;
}

// ---------------------------------------------------------------------------
// Default category mapping for built-in functions
// ---------------------------------------------------------------------------

const BUILTIN_CATEGORY_MAP: Record<string, FunctionCategory> = {
  rewrite_block: 'writing',
  complete_text: 'writing',
  improve_writing: 'review',
  summarize_document: 'analysis',
  extract_action_items: 'analysis',
  generate_outline: 'generation',
  generate_formula: 'generation',
  explain_formula: 'analysis',
  analyze_data: 'analysis',
  smart_fill: 'transform',
  clean_data: 'transform',
  suggest_chart: 'analysis',
  create_deck_from_outline: 'generation',
  rewrite_slide: 'writing',
  generate_speaker_notes: 'generation',
  suggest_layout: 'review',
  slide_coach: 'review',
  enhance_slide: 'formatting',
  generate_from_template: 'generation',
};

function inferCategory(fn: RegisteredFunction): FunctionCategory {
  return BUILTIN_CATEGORY_MAP[fn.name] ?? 'transform';
}

// ---------------------------------------------------------------------------
// Marketplace class
// ---------------------------------------------------------------------------

export class FunctionMarketplace {
  private entries: MarketplaceEntry[] = [];

  /**
   * Populate the marketplace from a list of registered functions.
   * Each function becomes a built-in entry with author "opencanvas".
   */
  populateFromRegistry(functions: RegisteredFunction[]): void {
    this.entries = functions.map((fn) => ({
      function: fn,
      category: inferCategory(fn),
      author: 'opencanvas',
      version: '0.1.0',
      downloads: 0,
      rating: 0,
    }));
  }

  /** Add or update a single entry. */
  addEntry(entry: MarketplaceEntry): void {
    const idx = this.entries.findIndex((e) => e.function.name === entry.function.name);
    if (idx >= 0) {
      this.entries[idx] = entry;
    } else {
      this.entries.push(entry);
    }
  }

  /** List all marketplace entries. */
  listAll(): MarketplaceEntry[] {
    return [...this.entries];
  }

  /** List entries filtered by category. */
  listByCategory(category: FunctionCategory): MarketplaceEntry[] {
    return this.entries.filter((e) => e.category === category);
  }

  /** Search entries by name or description (case-insensitive substring match). */
  search(query: string): MarketplaceEntry[] {
    const lower = query.toLowerCase();
    return this.entries.filter(
      (e) =>
        e.function.name.toLowerCase().includes(lower) ||
        e.function.description.toLowerCase().includes(lower),
    );
  }

  /** Return entries sorted by download count descending. */
  getPopular(limit = 10): MarketplaceEntry[] {
    return [...this.entries]
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }
}
