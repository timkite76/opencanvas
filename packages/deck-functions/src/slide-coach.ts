import type { BaseNode } from '@opencanvas/core-types';
import type {
  RegisteredFunction,
  FunctionExecutionContext,
  FunctionResult,
} from '@opencanvas/function-sdk';

type AnyNode = Record<string, unknown>;

function getNodePlainText(node: AnyNode): string {
  const content = node.content;
  if (!content || !Array.isArray(content)) return '';
  return content
    .map((run: unknown) => {
      if (run && typeof run === 'object' && 'text' in run) {
        return (run as { text: string }).text;
      }
      return '';
    })
    .join('');
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

interface CoachFeedbackItem {
  slideId: string;
  slideIndex: number;
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
}

export const slideCoachFunction: RegisteredFunction = {
  name: 'slide_coach',
  description: 'Review the entire deck and provide coaching feedback on content density, consistency, and structure',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  outputSchema: {
    type: 'object',
    properties: {
      feedback: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slideId: { type: 'string' },
            slideIndex: { type: 'number' },
            severity: { type: 'string' },
            category: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
      summary: { type: 'string' },
    },
  },
  permissions: {
    scope: 'artifact',
    mutatesArtifact: false,
    requiresApproval: false,
  },
  execute: async (context: FunctionExecutionContext): Promise<FunctionResult> => {
    const rootNode = context.artifact.nodes[context.artifact.rootNodeId] as BaseNode | undefined;
    if (!rootNode) {
      throw new Error('Root node not found');
    }

    const slideIds = rootNode.childIds ?? [];
    let feedback: CoachFeedbackItem[] = [];

    // Check slide count
    if (slideIds.length === 0) {
      feedback.push({
        slideId: context.artifact.rootNodeId,
        slideIndex: 0,
        severity: 'error',
        category: 'structure',
        message: 'This deck has no slides. Add content to get started.',
      });

      return {
        proposedOperations: [],
        previewText: 'Deck Review: This deck has no slides.',
        output: { feedback, summary: 'Empty deck' },
      };
    }

    if (context.callLlm) {
      // Real LLM call - gather deck summary
      const deckSummary: string[] = [];
      deckSummary.push(`Total slides: ${slideIds.length}`);

      for (let i = 0; i < Math.min(slideIds.length, 10); i++) {
        const slideNode = context.artifact.nodes[slideIds[i]!] as BaseNode | undefined;
        if (!slideNode) continue;

        const childIds = slideNode.childIds ?? [];
        const texts: string[] = [];
        for (const childId of childIds) {
          const child = context.artifact.nodes[childId] as unknown as AnyNode | undefined;
          if (child?.type === 'textbox') {
            const text = getNodePlainText(child);
            if (text) texts.push(text);
          }
        }

        if (texts.length > 0) {
          deckSummary.push(`Slide ${i + 1}: ${texts.join(' | ').slice(0, 100)}`);
        }
      }

      const systemPrompt = 'You are a presentation coach. Review this slide and give 3-5 specific, actionable suggestions to improve it. Return each suggestion on its own line prefixed with \'- \'.';
      const userPrompt = `Review this presentation deck:\n\n${deckSummary.join('\n')}`;

      try {
        const response = await context.callLlm({ systemPrompt, userPrompt });
        const lines = response
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('- '))
          .map((line) => line.slice(2).trim());

        feedback = lines.map((line, i) => ({
          slideId: slideIds[0]!,
          slideIndex: 0,
          severity: 'info' as const,
          category: 'content',
          message: line,
        }));
      } catch (error) {
        // Fall through to deterministic logic
      }
    }

    if (!context.callLlm || feedback.length === 0) {
      // Fallback to deterministic logic
      feedback = [];

      if (slideIds.length > 30) {
        feedback.push({
          slideId: slideIds[0]!,
          slideIndex: 0,
          severity: 'warning',
          category: 'structure',
          message: `This deck has ${slideIds.length} slides. Consider trimming to under 30 for audience engagement.`,
        });
      }

      if (slideIds.length < 3) {
        feedback.push({
          slideId: slideIds[0]!,
          slideIndex: 0,
          severity: 'info',
          category: 'structure',
          message: `This deck only has ${slideIds.length} slide(s). Most presentations benefit from at least 3-5 slides.`,
        });
      }

      // Check for title slide
      let hasTitleSlide = false;
      const allFontSizes: number[] = [];

      for (let i = 0; i < slideIds.length; i++) {
        const slideId = slideIds[i]!;
        const slideNode = context.artifact.nodes[slideId] as BaseNode | undefined;
        if (!slideNode) continue;

        const childIds = slideNode.childIds ?? [];
        const textBoxes: Array<{ node: AnyNode; text: string }> = [];
        let hasAnyContent = false;

        for (const childId of childIds) {
          const child = context.artifact.nodes[childId] as unknown as AnyNode | undefined;
          if (!child) continue;
          hasAnyContent = true;

          if (child.type === 'textbox') {
            const text = getNodePlainText(child);
            textBoxes.push({ node: child, text });

            // Collect font sizes
            const content = child.content as Array<{ fontSize?: number }> | undefined;
            if (content) {
              for (const run of content) {
                if (run.fontSize) allFontSizes.push(run.fontSize);
              }
            }
          }
        }

        // Check for empty slides
        if (!hasAnyContent || (textBoxes.length > 0 && textBoxes.every((tb) => tb.text.trim() === ''))) {
          feedback.push({
            slideId,
            slideIndex: i,
            severity: 'warning',
            category: 'content',
            message: `Slide ${i + 1} appears to be empty. Add content or remove this slide.`,
          });
          continue;
        }

        // Check for title slide (first slide with large bold text)
        if (i === 0) {
          const firstBoxContent = textBoxes[0]?.node.content as Array<{ bold?: boolean; fontSize?: number }> | undefined;
          if (firstBoxContent?.[0]?.bold && (firstBoxContent[0].fontSize ?? 0) >= 28) {
            hasTitleSlide = true;
          }
        }

        // Check word count per slide
        const slideWordCount = textBoxes.reduce((sum, tb) => sum + countWords(tb.text), 0);
        if (slideWordCount > 150) {
          feedback.push({
            slideId,
            slideIndex: i,
            severity: 'error',
            category: 'content',
            message: `Slide ${i + 1} has ${slideWordCount} words. Keep slides under 150 words for readability. Consider splitting this slide.`,
          });
        } else if (slideWordCount > 100) {
          feedback.push({
            slideId,
            slideIndex: i,
            severity: 'warning',
            category: 'content',
            message: `Slide ${i + 1} has ${slideWordCount} words. This is getting text-heavy. Consider condensing.`,
          });
        }
      }

      // Check for missing title slide
      if (!hasTitleSlide && slideIds.length > 1) {
        feedback.push({
          slideId: slideIds[0]!,
          slideIndex: 0,
          severity: 'info',
          category: 'structure',
          message: 'The first slide does not appear to be a clear title slide. Consider adding a prominent title.',
        });
      }

      // Check for inconsistent font sizes
      if (allFontSizes.length > 2) {
        const uniqueSizes = [...new Set(allFontSizes)].sort((a, b) => a - b);
        if (uniqueSizes.length > 4) {
          feedback.push({
            slideId: slideIds[0]!,
            slideIndex: 0,
            severity: 'warning',
            category: 'consistency',
            message: `The deck uses ${uniqueSizes.length} different font sizes (${uniqueSizes.join(', ')}). Stick to 2-3 sizes for a consistent look.`,
          });
        }
      }
    }

    // Build summary
    const errorCount = feedback.filter((f) => f.severity === 'error').length;
    const warningCount = feedback.filter((f) => f.severity === 'warning').length;
    const infoCount = feedback.filter((f) => f.severity === 'info').length;

    let summary: string;
    if (feedback.length === 0) {
      summary = 'Great job! This deck looks well-structured and balanced.';
    } else {
      const parts: string[] = [];
      if (errorCount > 0) parts.push(`${errorCount} issue(s)`);
      if (warningCount > 0) parts.push(`${warningCount} warning(s)`);
      if (infoCount > 0) parts.push(`${infoCount} suggestion(s)`);
      summary = `Found ${parts.join(', ')} across ${slideIds.length} slides.`;
    }

    // Build preview text
    const previewLines: string[] = [`Deck Review (${slideIds.length} slides)`, ''];

    if (feedback.length === 0) {
      previewLines.push(summary);
    } else {
      const severityIcon: Record<string, string> = {
        error: '[!]',
        warning: '[~]',
        info: '[i]',
      };

      for (const item of feedback) {
        previewLines.push(`${severityIcon[item.severity] ?? ''} ${item.message}`);
      }

      previewLines.push('', summary);
    }

    return {
      proposedOperations: [],
      previewText: previewLines.join('\n'),
      output: { feedback, summary },
    };
  },
};
