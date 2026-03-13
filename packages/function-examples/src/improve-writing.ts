import type { RegisteredFunction, FunctionExecutionContext, FunctionResult } from '@opencanvas/function-sdk';
import { getNodePlainText, type WriteNode } from '@opencanvas/write-model';

interface WritingSuggestion {
  type: 'passive_voice' | 'long_sentence' | 'jargon' | 'wordy_phrase';
  original: string;
  suggestion: string;
  offset: number;
}

/**
 * Detects passive voice constructions.
 * Looks for patterns like "was done by", "is being", "were made", etc.
 */
function detectPassiveVoice(text: string): WritingSuggestion[] {
  const suggestions: WritingSuggestion[] = [];
  const passivePatterns = [
    { pattern: /\b(was|were|is|are|been|being|be)\s+([\w]+ed)\b/gi, label: 'passive voice' },
    { pattern: /\b(was|were)\s+([\w]+en)\b/gi, label: 'passive voice' },
    { pattern: /\b(is|are|was|were)\s+being\s+([\w]+ed)\b/gi, label: 'passive voice' },
    { pattern: /\b(has|have|had)\s+been\s+([\w]+ed)\b/gi, label: 'passive voice' },
  ];

  for (const { pattern } of passivePatterns) {
    let match: RegExpExecArray | null;
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      suggestions.push({
        type: 'passive_voice',
        original: match[0],
        suggestion: `Consider using active voice instead of "${match[0]}"`,
        offset: match.index,
      });
    }
  }

  return suggestions;
}

/**
 * Flags sentences that are too long (>30 words).
 */
function detectLongSentences(text: string): WritingSuggestion[] {
  const suggestions: WritingSuggestion[] = [];
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0].trim();
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount > 30) {
      suggestions.push({
        type: 'long_sentence',
        original: sentence.slice(0, 60) + (sentence.length > 60 ? '...' : ''),
        suggestion: `This sentence has ${wordCount} words. Consider breaking it into shorter sentences for clarity.`,
        offset: match.index,
      });
    }
  }

  return suggestions;
}

/**
 * Detects common jargon and suggests simpler alternatives.
 */
function detectJargon(text: string): WritingSuggestion[] {
  const suggestions: WritingSuggestion[] = [];
  const jargonMap: Array<[RegExp, string]> = [
    [/\bsynergize\b/gi, 'work together'],
    [/\bsynergy\b/gi, 'cooperation'],
    [/\bleverage\b/gi, 'use'],
    [/\butilize\b/gi, 'use'],
    [/\bfacilitate\b/gi, 'help'],
    [/\boptimize\b/gi, 'improve'],
    [/\bstakeholder\b/gi, 'interested party'],
    [/\bactionable\b/gi, 'practical'],
    [/\bparadigm\b/gi, 'model'],
    [/\bholistic\b/gi, 'complete'],
    [/\bscalable\b/gi, 'expandable'],
    [/\brobust\b/gi, 'strong'],
    [/\bimpactful\b/gi, 'effective'],
    [/\bpivot\b/gi, 'change direction'],
    [/\bbandwidth\b/gi, 'capacity'],
    [/\blow-hanging fruit\b/gi, 'easy wins'],
    [/\bmove the needle\b/gi, 'make a difference'],
    [/\bdrilling down\b/gi, 'examining closely'],
    [/\bcircle back\b/gi, 'return to this'],
    [/\btake offline\b/gi, 'discuss separately'],
  ];

  for (const [pattern, simpler] of jargonMap) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      suggestions.push({
        type: 'jargon',
        original: match[0],
        suggestion: `Consider replacing "${match[0]}" with "${simpler}"`,
        offset: match.index,
      });
    }
  }

  return suggestions;
}

/**
 * Detects wordy phrases and suggests concise alternatives.
 */
function detectWordyPhrases(text: string): WritingSuggestion[] {
  const suggestions: WritingSuggestion[] = [];
  const wordyMap: Array<[RegExp, string]> = [
    [/\bat this point in time\b/gi, 'now'],
    [/\bin order to\b/gi, 'to'],
    [/\bdue to the fact that\b/gi, 'because'],
    [/\bin the event that\b/gi, 'if'],
    [/\bprior to\b/gi, 'before'],
    [/\bsubsequent to\b/gi, 'after'],
    [/\bin the near future\b/gi, 'soon'],
    [/\bfor the purpose of\b/gi, 'to'],
    [/\bin spite of the fact that\b/gi, 'although'],
    [/\bon a daily basis\b/gi, 'daily'],
    [/\bat the present time\b/gi, 'now'],
    [/\bhas the ability to\b/gi, 'can'],
  ];

  for (const [pattern, concise] of wordyMap) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      suggestions.push({
        type: 'wordy_phrase',
        original: match[0],
        suggestion: `Replace "${match[0]}" with "${concise}"`,
        offset: match.index,
      });
    }
  }

  return suggestions;
}

function formatSuggestionsAsPreview(text: string, suggestions: WritingSuggestion[]): string {
  if (suggestions.length === 0) {
    return 'No writing issues detected. The text reads well.';
  }

  const lines: string[] = [`Found ${suggestions.length} suggestion(s):\n`];

  // Group by type
  const grouped: Record<string, WritingSuggestion[]> = {};
  for (const s of suggestions) {
    const key = s.type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  const typeLabels: Record<string, string> = {
    passive_voice: 'Passive Voice',
    long_sentence: 'Long Sentences',
    jargon: 'Jargon',
    wordy_phrase: 'Wordy Phrases',
  };

  for (const [type, items] of Object.entries(grouped)) {
    lines.push(`[${typeLabels[type] ?? type}]`);
    for (const item of items) {
      lines.push(`  - ${item.suggestion}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const improveWritingFunction: RegisteredFunction = {
  name: 'improve_writing',
  description: 'Analyze text for grammar and style issues: passive voice, long sentences, jargon, and wordy phrases',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to analyze (optional if targetId is provided)' },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            original: { type: 'string' },
            suggestion: { type: 'string' },
            offset: { type: 'number' },
          },
        },
      },
    },
  },
  permissions: {
    scope: 'object',
    mutatesArtifact: false,
    requiresApproval: false,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    let text = context.parameters.text as string | undefined;

    if (!text) {
      const node = context.artifact.nodes[context.targetId] as WriteNode | undefined;
      if (!node) {
        throw new Error(`Node "${context.targetId}" not found`);
      }
      text = getNodePlainText(node);
    }

    if (!text) {
      throw new Error('No text content to analyze');
    }

    let suggestions: WritingSuggestion[];
    let previewText: string;

    if (context.callLlm) {
      // Real LLM call
      const systemPrompt = 'You are a professional editor. Analyze the text for grammar and style issues including passive voice, long sentences, jargon, and wordy phrases. Return each suggestion on its own line prefixed with \'- \'. Keep suggestions concise.';
      const userPrompt = `Analyze this text for writing improvements:\n\n${text}`;
      const response = await context.callLlm({ systemPrompt, userPrompt });

      // Parse response into suggestions
      const lines = response
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('- '))
        .map((line) => line.slice(2).trim());

      suggestions = lines.map((line, i) => ({
        type: 'jargon' as const,
        original: '',
        suggestion: line,
        offset: i,
      }));

      previewText = suggestions.length > 0
        ? `Found ${suggestions.length} suggestion(s):\n\n${lines.map((s) => `  - ${s}`).join('\n')}`
        : 'No writing issues detected. The text reads well.';
    } else {
      // Fallback to deterministic logic
      suggestions = [
        ...detectPassiveVoice(text),
        ...detectLongSentences(text),
        ...detectJargon(text),
        ...detectWordyPhrases(text),
      ];

      suggestions.sort((a, b) => a.offset - b.offset);
      previewText = formatSuggestionsAsPreview(text, suggestions);
    }

    return {
      proposedOperations: [],
      previewText,
      output: { suggestions },
    };
  },
};
