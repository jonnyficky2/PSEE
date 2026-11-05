/**
 * PSEE Phase 1 Adapter Verification Spike
 * Empirically tests connectivity, model discovery, and inference across Ollama, 9Router, and OpenCode.
 */

import { OllamaLocalAdapter } from '../adapters/ollama.adapter.js';
import { NineRouterGatewayAdapter } from '../adapters/ninerouter.adapter.js';
import { OpenCodeBridgeAdapter } from '../adapters/opencode.adapter.js';

async function runVerification() {
  console.log('====================================================');
  console.log(' PSEE Phase 1 — Multi-Provider Adapter Verification');
  console.log('====================================================\n');

  // 1. Ollama Local Adapter Test
  console.log('[1/3] Testing Ollama Local Adapter...');
  const ollama = new OllamaLocalAdapter();
  const ollamaHealthy = await ollama.healthCheck();
  console.log(`  - Healthcheck status : ${ollamaHealthy ? '🟢 HEALTHY' : '🔴 OFFLINE'}`);

  if (ollamaHealthy) {
    try {
      const models = await ollama.discoverModels();
      console.log(`  - Discovered models  : ${models.length} model(s) [${models.join(', ')}]`);

      const testModel = models.includes('qwen2.5-coder:7b') ? 'qwen2.5-coder:7b' : models[0];
      if (testModel) {
        console.log(`  - Running inference test with '${testModel}'...`);
        const res = await ollama.generate({
          requestId: 'test-ollama-001',
          taskId: 'spike-phase-1',
          modelId: testModel,
          messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
          timeoutMs: 15000,
        });
        console.log(`  - Output: "${res.content.trim()}" (latency: ${res.latencyMs}ms, finishReason: ${res.finishReason})`);
      }
    } catch (err: unknown) {
      console.log(`  - Inference error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');

  // 2. 9Router Gateway Adapter Test
  console.log('[2/3] Testing 9Router Gateway Adapter...');
  const nineRouter = new NineRouterGatewayAdapter();
  const nineHealthy = await nineRouter.healthCheck();
  console.log(`  - Healthcheck status : ${nineHealthy ? '🟢 HEALTHY' : '🟡 OFFLINE / STANDBY'}`);

  if (nineHealthy) {
    try {
      const models = await nineRouter.discoverModels();
      console.log(`  - Discovered models  : ${models.length} model(s) available in 9Router catalog`);

      const preferredModel = 'ag/gemini-3.8-flash-low';
      if (models.includes(preferredModel)) {
        console.log(`  - Running inference test with '${preferredModel}'...`);
        const res = await nineRouter.generate({
          requestId: 'test-9router-001',
          taskId: 'spike-phase-1',
          modelId: preferredModel,
          messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
          timeoutMs: 20000,
        });
        console.log(`  - Output: "${res.content.trim()}" (latency: ${res.latencyMs}ms, finishReason: ${res.finishReason})`);
      }
    } catch (err: unknown) {
      console.log(`  - Inference error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');

  // 3. OpenCode Bridge Adapter Test
  console.log('[3/3] Testing OpenCode Bridge Adapter...');
  const opencode = new OpenCodeBridgeAdapter();
  const ocCheck = await opencode.healthCheck();
  console.log(`  - Availability status: ${ocCheck.healthy ? '🟢 AVAILABLE' : '🔴 UNAVAILABLE'}`);
  console.log(`  - Details            : ${ocCheck.details}`);

  console.log('\n====================================================');
  console.log(' Verification Complete.');
  console.log('====================================================');
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
