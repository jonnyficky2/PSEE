import { OllamaLocalAdapter } from '../adapters/ollama.adapter.js';
import { NineRouterGatewayAdapter } from '../adapters/ninerouter.adapter.js';
import { OpenCodeBridgeAdapter } from '../adapters/opencode.adapter.js';
import { sanitize } from '../types/adapter-errors.js';

export type ProviderVerificationStatus = 'HEALTHY' | 'UNAVAILABLE' | 'ERROR';

export interface ProviderVerificationResult {
  provider: 'ollama' | 'nineRouter' | 'openCode';
  status: ProviderVerificationStatus;
  healthy: boolean;
  details: string;
  discoveredModels?: string[];
  testInference?: {
    modelId: string;
    success: boolean;
    latencyMs?: number;
    output?: string;
    error?: string;
  };
}

export interface EnvironmentVerificationReport {
  timestamp: string;
  summary: {
    total: number;
    healthy: number;
    unavailable: number;
    error: number;
  };
  providers: {
    ollama: ProviderVerificationResult;
    nineRouter: ProviderVerificationResult;
    openCode: ProviderVerificationResult;
  };
}

export interface VerificationAdapters {
  ollama?: Pick<OllamaLocalAdapter, 'healthCheck' | 'discoverModels' | 'generate'>;
  nineRouter?: Pick<NineRouterGatewayAdapter, 'healthCheck' | 'discoverModels' | 'generate'>;
  openCode?: Pick<OpenCodeBridgeAdapter, 'healthCheck'>;
}

export async function verifyEnvironment(adapters?: VerificationAdapters): Promise<EnvironmentVerificationReport> {
  const ollama = adapters?.ollama ?? new OllamaLocalAdapter();
  const nineRouter = adapters?.nineRouter ?? new NineRouterGatewayAdapter();
  const openCode = adapters?.openCode ?? new OpenCodeBridgeAdapter();

  // 1. Ollama local verification
  let ollamaResult: ProviderVerificationResult;
  try {
    const isHealthy = await ollama.healthCheck();
    if (isHealthy) {
      let models: string[] = [];
      try {
        models = await ollama.discoverModels();
      } catch {
        models = [];
      }
      let testInf: ProviderVerificationResult['testInference'];
      const testModel = models.includes('qwen2.5-coder:7b') ? 'qwen2.5-coder:7b' : models[0];
      if (testModel) {
        try {
          const res = await ollama.generate({
            requestId: 'verify-ollama', taskId: 'env-verify', modelId: testModel,
            messages: [{ role: 'user', content: 'ok' }], timeoutMs: 10000,
          });
          testInf = { modelId: testModel, success: true, latencyMs: res.latencyMs, output: sanitize(res.content.trim()) };
        } catch (err: unknown) {
          testInf = { modelId: testModel, success: false, error: sanitize(err instanceof Error ? err.message : String(err)) };
        }
      }
      ollamaResult = {
        provider: 'ollama',
        status: 'HEALTHY',
        healthy: true,
        details: sanitize(`Connected to Ollama daemon (${models.length} models available)`),
        discoveredModels: models,
        testInference: testInf,
      };
    } else {
      ollamaResult = {
        provider: 'ollama',
        status: 'UNAVAILABLE',
        healthy: false,
        details: 'Ollama daemon is not reachable at configured endpoint (offline / not running)',
      };
    }
  } catch (err: unknown) {
    ollamaResult = {
      provider: 'ollama',
      status: 'ERROR',
      healthy: false,
      details: sanitize(`Unexpected error during Ollama verification: ${err instanceof Error ? err.message : String(err)}`),
    };
  }

  // 2. 9Router gateway verification
  let nineRouterResult: ProviderVerificationResult;
  try {
    const isHealthy = await nineRouter.healthCheck();
    if (isHealthy) {
      let models: string[] = [];
      try {
        models = await nineRouter.discoverModels();
      } catch {
        models = [];
      }
      let testInf: ProviderVerificationResult['testInference'];
      const preferredModel = 'ag/gemini-3.8-flash-low';
      const testModel = models.includes(preferredModel) ? preferredModel : models[0];
      if (testModel) {
        try {
          const res = await nineRouter.generate({
            requestId: 'verify-9router', taskId: 'env-verify', modelId: testModel,
            messages: [{ role: 'user', content: 'ok' }], timeoutMs: 15000,
          });
          testInf = { modelId: testModel, success: true, latencyMs: res.latencyMs, output: sanitize(res.content.trim()) };
        } catch (err: unknown) {
          testInf = { modelId: testModel, success: false, error: sanitize(err instanceof Error ? err.message : String(err)) };
        }
      }
      nineRouterResult = {
        provider: 'nineRouter',
        status: 'HEALTHY',
        healthy: true,
        details: sanitize(`Connected to 9Router gateway (${models.length} models cataloged)`),
        discoveredModels: models,
        testInference: testInf,
      };
    } else {
      nineRouterResult = {
        provider: 'nineRouter',
        status: 'UNAVAILABLE',
        healthy: false,
        details: '9Router gateway is not reachable at configured endpoint (standby / offline)',
      };
    }
  } catch (err: unknown) {
    nineRouterResult = {
      provider: 'nineRouter',
      status: 'ERROR',
      healthy: false,
      details: sanitize(`Unexpected error during 9Router verification: ${err instanceof Error ? err.message : String(err)}`),
    };
  }

  // 3. OpenCode bridge verification
  let openCodeResult: ProviderVerificationResult;
  try {
    const health = await openCode.healthCheck();
    if (health.healthy) {
      openCodeResult = {
        provider: 'openCode',
        status: 'HEALTHY',
        healthy: true,
        details: sanitize(health.details ?? 'OpenCode CLI binary is available and executable'),
      };
    } else {
      openCodeResult = {
        provider: 'openCode',
        status: 'UNAVAILABLE',
        healthy: false,
        details: sanitize(health.details ?? 'OpenCode CLI binary is not installed or not in PATH'),
      };
    }
  } catch (err: unknown) {
    openCodeResult = {
      provider: 'openCode',
      status: 'ERROR',
      healthy: false,
      details: sanitize(`Unexpected error during OpenCode verification: ${err instanceof Error ? err.message : String(err)}`),
    };
  }

  const results = [ollamaResult, nineRouterResult, openCodeResult];
  return {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      healthy: results.filter((r) => r.status === 'HEALTHY').length,
      unavailable: results.filter((r) => r.status === 'UNAVAILABLE').length,
      error: results.filter((r) => r.status === 'ERROR').length,
    },
    providers: {
      ollama: ollamaResult,
      nineRouter: nineRouterResult,
      openCode: openCodeResult,
    },
  };
}
