import type { LlmRequest, LlmResponse, LlmProviderConfig, LlmCallOptions, LlmProvider } from './types.js';
import { callAnthropic } from './providers/anthropic.js';
import { callOpenAI } from './providers/openai.js';

export class LlmClient {
  private providers = new Map<LlmProvider, LlmProviderConfig>();
  private defaultProvider: LlmProvider | null = null;

  addProvider(config: LlmProviderConfig): void {
    this.providers.set(config.provider, config);
    if (!this.defaultProvider) {
      this.defaultProvider = config.provider;
    }
  }

  removeProvider(provider: LlmProvider): void {
    this.providers.delete(provider);
    if (this.defaultProvider === provider) {
      this.defaultProvider = this.providers.size > 0 ? this.providers.keys().next().value ?? null : null;
    }
  }

  getConfiguredProviders(): LlmProvider[] {
    return Array.from(this.providers.keys());
  }

  isConfigured(): boolean {
    return this.providers.size > 0;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const config = this.providers.get(request.provider);
    if (!config) {
      throw new Error(`Provider "${request.provider}" is not configured. Add an API key in the admin panel.`);
    }

    const fullRequest: LlmRequest = {
      ...request,
      apiKey: config.apiKey,
      baseUrl: request.baseUrl ?? config.baseUrl,
    };

    switch (request.provider) {
      case 'anthropic':
        return callAnthropic(fullRequest);
      case 'openai':
        return callOpenAI(fullRequest);
      default:
        throw new Error(`Unsupported provider: ${request.provider}`);
    }
  }

  /**
   * Simplified call interface for functions.
   * Uses the default provider and model config from model-router.
   */
  async call(
    options: LlmCallOptions & { provider: LlmProvider; model: string },
  ): Promise<LlmResponse> {
    return this.complete({
      provider: options.provider,
      model: options.model,
      apiKey: '', // will be filled from provider config
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      maxTokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.5,
    });
  }
}
