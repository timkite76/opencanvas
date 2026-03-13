export type LlmProvider = 'anthropic' | 'openai';

export interface LlmProviderConfig {
  provider: LlmProvider;
  apiKey: string;
  baseUrl?: string;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  provider: LlmProvider;
  model: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature: number;
  apiKey: string;
  baseUrl?: string;
}

export interface LlmResponse {
  text: string;
  model: string;
  provider: LlmProvider;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface LlmCallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}
