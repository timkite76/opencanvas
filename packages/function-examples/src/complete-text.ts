import type { RegisteredFunction, FunctionExecutionContext, FunctionResult } from '@opencanvas/function-sdk';
import { getNodePlainText, type WriteNode } from '@opencanvas/write-model';

/**
 * Generates a plausible text continuation based on patterns in the existing text.
 * This is a deterministic, pattern-matching approach (MVP) that will later be
 * replaced by an LLM call via model-router.
 */
function generateCompletion(text: string, cursorOffset: number): string {
  const textBeforeCursor = text.slice(0, cursorOffset).trimEnd();

  if (!textBeforeCursor) {
    return '';
  }

  // Get the last sentence or fragment
  const lastSentenceMatch = textBeforeCursor.match(/(?:[.!?]\s+)?([^.!?]*?)$/);
  const lastFragment = lastSentenceMatch ? lastSentenceMatch[1].trim() : textBeforeCursor;
  const lowerFragment = lastFragment.toLowerCase();

  // Pattern: common phrase completions
  const phraseCompletions: Array<[RegExp, string]> = [
    [/in conclusion,?\s*$/i, 'the evidence suggests that the approach outlined above provides a strong foundation for moving forward.'],
    [/on the other hand,?\s*$/i, 'there are compelling reasons to consider an alternative perspective on this matter.'],
    [/for example,?\s*$/i, 'this can be observed in several practical scenarios that demonstrate the underlying principle.'],
    [/as a result,?\s*$/i, 'the outcomes clearly reflect the impact of the decisions made throughout the process.'],
    [/in addition,?\s*$/i, 'there are several other factors that contribute to the overall effectiveness of this approach.'],
    [/however,?\s*$/i, 'it is important to note that there are limitations that should be carefully considered.'],
    [/furthermore,?\s*$/i, 'the data supports the conclusion that additional measures may strengthen the overall outcome.'],
    [/to summarize,?\s*$/i, 'the key points discussed above highlight the importance of a thoughtful and measured approach.'],
    [/it is worth noting that\s*$/i, 'these findings align with broader trends observed across the industry.'],
    [/the goal is to\s*$/i, 'establish a clear and actionable framework that addresses the core challenges identified.'],
    [/this means that\s*$/i, 'the team will need to adapt its approach to align with the revised objectives.'],
    [/next steps include\s*$/i, 'conducting a thorough review of the current state and defining measurable milestones.'],
    [/the primary objective is\s*$/i, 'to deliver a solution that meets the stated requirements within the defined timeline.'],
  ];

  for (const [pattern, completion] of phraseCompletions) {
    if (pattern.test(textBeforeCursor)) {
      return completion;
    }
  }

  // Pattern: text ends with an article or preposition — suggest a relevant noun/phrase
  const articleEndPatterns: Array<[RegExp, string]> = [
    [/\bthe\s*$/i, 'proposed approach'],
    [/\ba\s*$/i, 'comprehensive strategy'],
    [/\ban\s*$/i, 'effective solution'],
    [/\bwith\s*$/i, 'the necessary resources and support'],
    [/\bfrom\s*$/i, 'the perspective of all stakeholders involved'],
    [/\binto\s*$/i, 'a well-defined process that ensures consistency'],
    [/\babout\s*$/i, 'the critical factors that influence the outcome'],
    [/\bthrough\s*$/i, 'a systematic and transparent methodology'],
  ];

  for (const [pattern, completion] of articleEndPatterns) {
    if (pattern.test(textBeforeCursor)) {
      return completion;
    }
  }

  // Pattern: mid-sentence (no terminal punctuation) — complete the sentence
  const endsWithPunctuation = /[.!?;]\s*$/.test(textBeforeCursor);

  if (!endsWithPunctuation && lastFragment.length > 5) {
    // Analyze context words to generate a contextual completion
    const words = lastFragment.split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase() ?? '';

    const contextCompletions: Record<string, string> = {
      should: ' be reviewed and validated before proceeding to the next phase.',
      must: ' be addressed as a priority to ensure compliance with the stated requirements.',
      will: ' be implemented according to the established timeline and resource plan.',
      can: ' be achieved by following the recommended best practices.',
      need: ' to coordinate with the relevant teams to ensure alignment.',
      require: ' careful planning and dedicated resources to execute effectively.',
      ensure: ' that all stakeholders are informed and aligned with the current direction.',
      consider: ' the potential impact on existing workflows and team capacity.',
      recommend: ' a phased approach that allows for iterative feedback and improvement.',
      propose: ' a framework that balances efficiency with thoroughness.',
      is: ' an important consideration that warrants further discussion.',
      are: ' essential components of the overall strategy.',
    };

    if (contextCompletions[lastWord]) {
      return contextCompletions[lastWord];
    }

    // Default mid-sentence: provide a generic but relevant continuation
    return ', which should be evaluated against the project objectives and constraints.';
  }

  // Pattern: after a complete sentence — start a new one related to the topic
  if (endsWithPunctuation) {
    // Extract topic words (nouns, long words) for context-aware continuation
    const topicWords = textBeforeCursor
      .split(/\s+/)
      .filter((w) => w.length > 5)
      .map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))
      .filter(Boolean);

    if (topicWords.includes('project') || topicWords.includes('timeline')) {
      return ' The project timeline should account for potential risks and dependencies.';
    }
    if (topicWords.includes('team') || topicWords.includes('collaboration')) {
      return ' Effective collaboration across teams will be critical to achieving the desired outcomes.';
    }
    if (topicWords.includes('data') || topicWords.includes('analysis')) {
      return ' Further analysis of the available data will help refine the approach.';
    }
    if (topicWords.includes('design') || topicWords.includes('user') || topicWords.includes('interface')) {
      return ' The design should prioritize clarity and ease of use for the target audience.';
    }
    if (topicWords.includes('performance') || topicWords.includes('optimization')) {
      return ' Performance benchmarks should be established to measure the impact of these changes.';
    }
    if (topicWords.includes('security') || topicWords.includes('compliance')) {
      return ' Security and compliance requirements must be factored into every phase of the implementation.';
    }
    if (topicWords.includes('budget') || topicWords.includes('cost') || topicWords.includes('resource')) {
      return ' Resource allocation should be reviewed regularly to ensure alignment with the budget.';
    }

    return ' This warrants further exploration to identify additional opportunities for improvement.';
  }

  return '';
}

export const completeTextFunction: RegisteredFunction = {
  name: 'complete_text',
  description: 'Generate a text completion suggestion based on the current document context',
  inputSchema: {
    type: 'object',
    properties: {
      cursorOffset: { type: 'number', description: 'Cursor position within the target block' },
      contextText: { type: 'string', description: 'Full document text for broader context' },
    },
    required: ['cursorOffset'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      completion: { type: 'string' },
    },
  },
  permissions: {
    scope: 'object',
    mutatesArtifact: false,
    requiresApproval: false,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const node = context.artifact.nodes[context.targetId] as WriteNode | undefined;
    if (!node) {
      throw new Error(`Node "${context.targetId}" not found`);
    }

    const nodeText = getNodePlainText(node);
    const cursorOffset = (context.parameters.cursorOffset as number) ?? nodeText.length;

    // Use contextText if available for richer pattern matching, otherwise just node text
    const contextText = (context.parameters.contextText as string) ?? nodeText;
    const completion = generateCompletion(contextText, cursorOffset);

    return {
      proposedOperations: [],
      previewText: completion,
      output: { completion },
    };
  },
};
