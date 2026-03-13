/**
 * Multi-model routing configuration.
 *
 * Defines model tiers, routing rules that map AI function names to tiers,
 * and a resolver that returns the appropriate model config for a given function.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelTier = 'fast' | 'standard' | 'premium';

export interface ModelConfig {
  tier: ModelTier;
  modelId: string;
  provider: string;
  maxTokens: number;
  temperature: number;
}

export interface ModelRoutingRule {
  /** Regex pattern matched against function names */
  functionPattern: string;
  tier: ModelTier;
  reason: string;
}

// ---------------------------------------------------------------------------
// Default tier configs
// ---------------------------------------------------------------------------

const TIER_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: 'fast',
    modelId: 'claude-3-5-haiku-latest',
    provider: 'anthropic',
    maxTokens: 1024,
    temperature: 0.3,
  },
  standard: {
    tier: 'standard',
    modelId: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    maxTokens: 4096,
    temperature: 0.5,
  },
  premium: {
    tier: 'premium',
    modelId: 'claude-opus-4-20250514',
    provider: 'anthropic',
    maxTokens: 8192,
    temperature: 0.7,
  },
};

// ---------------------------------------------------------------------------
// Default routing rules (evaluated in order, first match wins)
// ---------------------------------------------------------------------------

const DEFAULT_ROUTING_RULES: ModelRoutingRule[] = [
  {
    functionPattern: '^complete_text$',
    tier: 'fast',
    reason: 'Inline completions need speed',
  },
  {
    functionPattern: '^(improve_writing|explain_formula|suggest_chart|slide_coach|analyze_data)$',
    tier: 'standard',
    reason: 'Analysis tasks require balanced quality and speed',
  },
  {
    functionPattern:
      '^(summarize_document|generate_outline|create_deck_from_outline|enhance_slide)$',
    tier: 'premium',
    reason: 'Complex generation tasks require highest quality',
  },
  {
    functionPattern: '.*',
    tier: 'standard',
    reason: 'Default routing for unmatched functions',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the model configuration for a given AI function name.
 *
 * Iterates over routing rules in order and returns the ModelConfig
 * for the first matching rule's tier.
 */
export function resolveModel(functionName: string): ModelConfig {
  for (const rule of DEFAULT_ROUTING_RULES) {
    const regex = new RegExp(rule.functionPattern);
    if (regex.test(functionName)) {
      return { ...TIER_CONFIGS[rule.tier] };
    }
  }
  // Fallback (should never reach here due to .* rule)
  return { ...TIER_CONFIGS.standard };
}

/**
 * Return all current routing rules.
 */
export function getRoutingRules(): ModelRoutingRule[] {
  return DEFAULT_ROUTING_RULES.map((r) => ({ ...r }));
}

/**
 * Return the display label for a model tier (for UI display).
 */
export function tierLabel(tier: ModelTier): string {
  switch (tier) {
    case 'fast':
      return 'Fast model';
    case 'standard':
      return 'Standard model';
    case 'premium':
      return 'Premium model';
  }
}
