import React, { useState, useEffect, useCallback, useMemo } from 'react';

const AI_RUNTIME_URL = 'http://localhost:4001';

interface FunctionEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: {
    scope: string;
    mutatesArtifact: boolean;
    requiresApproval: boolean;
  };
}

/** Infer a category from the function name (matches marketplace.ts logic). */
function inferCategory(name: string): string {
  const map: Record<string, string> = {
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
  return map[name] ?? 'transform';
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  writing: { bg: '#ede9fe', text: '#7c3aed' },
  analysis: { bg: '#dbeafe', text: '#2563eb' },
  generation: { bg: '#d1fae5', text: '#059669' },
  review: { bg: '#fef3c7', text: '#d97706' },
  formatting: { bg: '#fce7f3', text: '#db2777' },
  transform: { bg: '#e0e7ff', text: '#4f46e5' },
};

const ALL_CATEGORIES = ['writing', 'analysis', 'generation', 'review', 'formatting', 'transform'];

interface FunctionBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FunctionBrowser: React.FC<FunctionBrowserProps> = ({ isOpen, onClose }) => {
  const [functions, setFunctions] = useState<FunctionEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFunctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AI_RUNTIME_URL}/functions`);
      if (!res.ok) throw new Error('Failed to fetch functions');
      const data = await res.json() as { functions: FunctionEntry[] };
      setFunctions(data.functions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFunctions();
    }
  }, [isOpen, fetchFunctions]);

  const filtered = useMemo(() => {
    let result = functions;

    if (activeCategory) {
      result = result.filter((fn) => inferCategory(fn.name) === activeCategory);
    }

    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (fn) =>
          fn.name.toLowerCase().includes(lower) ||
          fn.description.toLowerCase().includes(lower),
      );
    }

    return result;
  }, [functions, searchQuery, activeCategory]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 480,
        background: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.08)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
          AI Functions
        </h3>
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            fontSize: 18,
            cursor: 'pointer',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          x
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search functions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            color: '#374151',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#4a90d9'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
        />
      </div>

      {/* Category filters */}
      <div style={{
        padding: '8px 20px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            padding: '4px 10px',
            borderRadius: 12,
            border: '1px solid',
            borderColor: activeCategory === null ? '#4a90d9' : '#d1d5db',
            background: activeCategory === null ? '#eff6ff' : '#fff',
            color: activeCategory === null ? '#2563eb' : '#6b7280',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          All
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const colors = CATEGORY_COLORS[cat]!;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? null : cat)}
              style={{
                padding: '4px 10px',
                borderRadius: 12,
                border: '1px solid',
                borderColor: isActive ? colors.text : '#d1d5db',
                background: isActive ? colors.bg : '#fff',
                color: isActive ? colors.text : '#6b7280',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>
            Loading functions...
          </div>
        )}

        {error && (
          <div style={{
            padding: 16,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#dc2626',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {filtered.map((fn) => {
              const cat = inferCategory(fn.name);
              const colors = CATEGORY_COLORS[cat] ?? { bg: '#f3f4f6', text: '#6b7280' };

              return (
                <div
                  key={fn.name}
                  style={{
                    padding: '14px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#ffffff',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Category badge */}
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: colors.bg,
                      color: colors.text,
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      marginBottom: 8,
                    }}
                  >
                    {cat}
                  </span>

                  {/* Name */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                    {fn.name.replace(/_/g, ' ')}
                  </div>

                  {/* Description */}
                  <div style={{
                    fontSize: 12,
                    color: '#6b7280',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {fn.description}
                  </div>

                  {/* Metadata */}
                  <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', display: 'flex', gap: 8 }}>
                    <span>Scope: {fn.permissions.scope}</span>
                    {fn.permissions.requiresApproval && (
                      <span style={{ color: '#d97706' }}>Requires approval</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>
            No functions match your search.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 20px',
        borderTop: '1px solid #e5e7eb',
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        flexShrink: 0,
      }}>
        {functions.length} functions available
      </div>
    </div>
  );
};
