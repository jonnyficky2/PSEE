import { startPseeRuntime, type PseeRuntime } from './bootstrap.js';

export function createShutdown(close: () => Promise<void>, exit: (code: number) => void = process.exit): () => Promise<void> {
  let promise: Promise<void> | undefined;
  return () => {
    if (!promise) {
      promise = close().catch((error) => {
        console.error('PSEE shutdown failed');
        exit(1);
        throw error;
      });
    }
    return promise;
  };
}

export async function runCli(env: Record<string, string | undefined> = process.env): Promise<PseeRuntime> {
  let runtime: PseeRuntime;
  try {
    runtime = await startPseeRuntime(env);
  } catch (error) {
    console.error(`PSEE startup failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
    throw error;
  }

  const shutdown = createShutdown(async () => {
    await runtime.close();
    process.exitCode = 0;
  });
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  console.log(`PSEE listening on ${runtime.config.host}:${runtime.config.port}`);
  return runtime;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runCli().catch(() => undefined);
}
