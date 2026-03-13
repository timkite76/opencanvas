import Anthropic from '@anthropic-ai/sdk';
import type { LlmRequest, LlmResponse } from '../types.js';

export async function callAnthropic(request: LlmRequest): Promise<LlmResponse> {
  const client = new Anthropic({
    apiKey: request.apiKey,
    ...(request.baseUrl ? { baseURL: request.baseUrl } : {}),
  });

  // Extract system message and non-system messages
  const systemMessage = request.messages.find(m => m.role === 'system');
  const userMessages = request.messages.filter(m => m.role !== 'system');

  const response = await client.messages.create({
    model: request.model,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    ...(systemMessage ? { system: systemMessage.content } : {}),
    messages: userMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const textBlock = response.content.find(c => c.type === 'text');
  const text = textBlock && 'text' in textBlock ? textBlock.text : '';

  return {
    text,
    model: response.model,
    provider: 'anthropic',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
    finishReason: response.stop_reason ?? 'unknown',
  };
}
