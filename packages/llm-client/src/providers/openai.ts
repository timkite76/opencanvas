import OpenAI from 'openai';
import type { LlmRequest, LlmResponse } from '../types.js';

export async function callOpenAI(request: LlmRequest): Promise<LlmResponse> {
  const client = new OpenAI({
    apiKey: request.apiKey,
    ...(request.baseUrl ? { baseURL: request.baseUrl } : {}),
  });

  const response = await client.chat.completions.create({
    model: request.model,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    messages: request.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const choice = response.choices[0];
  const text = choice?.message?.content ?? '';

  return {
    text,
    model: response.model,
    provider: 'openai',
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
    finishReason: choice?.finish_reason ?? 'unknown',
  };
}
