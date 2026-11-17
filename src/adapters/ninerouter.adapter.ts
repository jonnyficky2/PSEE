import type {
  ModelAdapter,
  NormalizedRequest,
  NormalizedResponse,
} from '../types/index.js';
import { sanitize, AdapterError, AdapterFailure } from '../types/adapter-errors.js';

export interface NineRouterAdapterOptions {
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
}

export class NineRouterGatewayAdapter implements ModelAdapter {
  readonly id = '9router';
  readonly type = 'gateway' as const;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly defaultModel: string;

  constructor(options: NineRouterAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://127.0.0.1:20128').replace(/\/$/, '');
    this.apiKey = options.apiKey || process.env.PSEE_9ROUTER_API_KEY;
    this.defaultModel = options.defaultModel || 'ag/gemini-3.8-flash-low';
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers,
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
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(`${this.baseUrl}/v1/models`, { headers });
      if (!res.ok) {
        throw new Error(`9Router returned status ${res.status}`);
      }
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }
      return data.data.map((m) => m.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to discover 9Router models: ${message}`);
    }
  }

  async generate(request: NormalizedRequest): Promise<NormalizedResponse> {
    const startTime = Date.now();
    const model = request.modelId || this.defaultModel;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs || 45000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

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
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = sanitize(await res.text());
        if (res.status === 429) {
          throw new AdapterError(AdapterFailure.RATE_LIMITED, `RATE_LIMITED: 9Router returned 429 for ${model}: ${errText}`);
        }
        if (res.status === 402) {
          throw new AdapterError(AdapterFailure.CREDITS_REQUIRED, `CREDITS_REQUIRED: Model ${model} requires paid credits: ${errText}`);
        }
        if (res.status === 401 || res.status === 403) {
          throw new AdapterError(AdapterFailure.AUTH_FAILED, `AUTH_FAILED: 9Router authentication failed (${res.status}): ${errText}`);
        }
        if (res.status >= 500) {
          throw new AdapterError(AdapterFailure.SERVER_ERROR, `SERVER_ERROR: 9Router server error (${res.status}): ${errText}`);
        }
        throw new AdapterError(AdapterFailure.UNKNOWN, `9Router chat completion failed (${res.status}): ${errText}`);
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
        throw new AdapterError(AdapterFailure.MALFORMED_RESPONSE, 'Malformed 9Router response: missing choices[0].message.content');
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
      if (err instanceof AdapterError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AdapterError(AdapterFailure.TIMEOUT, `9Router request timed out after ${request.timeoutMs}ms`);
      }
      throw new AdapterError(AdapterFailure.UNKNOWN, `9Router request failed: ${sanitize(err instanceof Error ? err.message : String(err))}`, err);
    } finally {
      clearTimeout(timeout);
    }
  }
}
