import { createServer, type Server } from 'node:http';
import { PseeDatabase } from '../db/database.js';
import { ExecutionPersistenceService } from '../persistence/execution.persistence.js';
import { OrchestrationService } from '../orchestration/orchestration.service.js';
import { OpenCodeBridgeAdapter } from '../adapters/opencode.adapter.js';
import { FreeFirstPolicyEngine } from '../policy/policy.engine.js';
import { GitWorktreeManager } from '../isolation/worktree.manager.js';
import { CheckpointEngine } from '../checkpoint/checkpoint.engine.js';
import { createOrchestrationHttpServer, adaptOrchestrationService } from '../api/http-server.js';

export interface RuntimeConfig { host: string; port: number; dbPath: string; }
export type RuntimeEnvironment = Record<string, string | undefined>;

export function createRuntimeConfig(env: RuntimeEnvironment = process.env): RuntimeConfig {
  const port = env.PSEE_PORT === undefined ? 3000 : Number(env.PSEE_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PSEE_PORT must be an integer between 1 and 65535');
  return { host: env.PSEE_HOST || '127.0.0.1', port, dbPath: env.PSEE_DB_PATH || '.psee/psee_state.sqlite' };
}

export interface PseeRuntime { config: RuntimeConfig; server: Server; database: PseeDatabase; close(): Promise<void>; }

export function createPseeRuntime(env: RuntimeEnvironment = process.env): PseeRuntime {
  const config = createRuntimeConfig(env);
  const database = new PseeDatabase({ dbPath: config.dbPath });
  const persistence = new ExecutionPersistenceService(database);
  const policy = new FreeFirstPolicyEngine();
  const worktrees = new GitWorktreeManager();
  const checkpoints = new CheckpointEngine(database);
  const adapter = new OpenCodeBridgeAdapter({ binaryPath: env.PSEE_OPENCODE_BIN });
  const service = new OrchestrationService({
    persistence,
    adapter,
    selectRoute: (request) => policy.selectRoute({ ...request, allowPaid: false }),
    createWorktree: (taskId) => worktrees.createWorktree(taskId),
    saveCheckpoint: (data) => checkpoints.saveCheckpoint(data),
  });
  const server = createOrchestrationHttpServer(adaptOrchestrationService(service));
  let closed = false;
  return {
    config, server, database,
    close: () => new Promise<void>((resolve, reject) => {
      if (closed) return resolve();
      closed = true;
      if (!server.listening) { database.close(); return resolve(); }
      server.close((error) => { database.close(); error ? reject(error) : resolve(); });
    }),
  };
}

export async function startPseeRuntime(env: RuntimeEnvironment = process.env): Promise<PseeRuntime> {
  const runtime = createPseeRuntime(env);
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => { runtime.server.off('listening', onListening); reject(error); };
      const onListening = () => { runtime.server.off('error', onError); resolve(); };
      runtime.server.once('error', onError);
      runtime.server.once('listening', onListening);
      runtime.server.listen(runtime.config.port, runtime.config.host);
    });
    return runtime;
  } catch (error) {
    await runtime.close().catch(() => undefined);
    throw new Error(`PSEE server startup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
