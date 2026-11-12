import type {
  ModelAdapter,
  NormalizedRequest,
  NormalizedResponse,
} from '../types/index.js';

export interface OllamaAdapterOptions {
  baseUrl?: string;
  defaultModel?: string;
}

export class OllamaLocalAdapter implements ModelAdapter {
  readonly id = 'ollama';
  readonly type = 'local' as const;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(options: OllamaAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
    this.defaultModel = options.defaultModel || 'qwen2.5-coder:7b';
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async discoverModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) {
        throw new Error(`Ollama returned status ${res.status}`);
      }
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }
      return data.models.map((m) => m.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to discover Ollama models: ${message}`);
    }
  }

  async generate(request: NormalizedRequest): Promise<NormalizedResponse> {
    const startTime = Date.now();
    const model = request.modelId || this.defaultModel;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs || 30000);

    try {
      const payload = {
        model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens,
        stream: false,
      };

      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama chat completion failed (${res.status}): ${errText}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const choice = json.choices?.[0];
      if (typeof choice?.message?.content !== 'string') {
        throw new Error('Malformed Ollama response: missing choices[0].message.content');
      }
      const content = choice.message.content;
      const finishReason = (choice.finish_reason as 'stop' | 'length') || 'stop';

      return {
        requestId: request.requestId,
        providerId: this.id,
        modelId: model,
        content,
        finishReason,
        usage: {
          inputTokens: json.usage?.prompt_tokens ?? null,
          outputTokens: json.usage?.completion_tokens ?? null,
          totalTokens: json.usage?.total_tokens ?? null,
        },
        latencyMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${request.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
