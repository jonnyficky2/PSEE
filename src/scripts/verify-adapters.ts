/**
 * PSEE Multi-Provider Environment Verification Script
 * Tests connectivity, model discovery, and inference across Ollama, 9Router, and OpenCode.
 * Distinguishes unavailable dependencies (offline) from implementation failures.
 */

import { verifyEnvironment } from '../verification/environment.verifier.js';

async function runVerification() {
  console.log('====================================================');
  console.log(' PSEE Multi-Provider Environment Verification');
  console.log('====================================================\n');

  const report = await verifyEnvironment();

  for (const [key, res] of Object.entries(report.providers)) {
    const icon = res.status === 'HEALTHY' ? '🟢' : res.status === 'UNAVAILABLE' ? '🟡' : '🔴';
    console.log(`[${key}] ${icon} ${res.status}: ${res.details}`);
    if (res.discoveredModels && res.discoveredModels.length > 0) {
      console.log(`  - Discovered models : ${res.discoveredModels.length} model(s) [${res.discoveredModels.slice(0, 5).join(', ')}${res.discoveredModels.length > 5 ? '...' : ''}]`);
    }
    if (res.testInference) {
      if (res.testInference.success) {
        console.log(`  - Inference test    : "${res.testInference.output}" (${res.testInference.latencyMs}ms with '${res.testInference.modelId}')`);
      } else {
        console.log(`  - Inference error   : ${res.testInference.error}`);
      }
    }
  }

  console.log('\n====================================================');
  console.log(` Summary: ${report.summary.healthy} healthy, ${report.summary.unavailable} unavailable (offline), ${report.summary.error} errors`);
  console.log('====================================================');

  if (report.summary.error > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
