import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, normalize, resolve, sep } from 'node:path';
import type { OrchestrationRequest, OrchestrationResult, OrchestrationService } from '../orchestration/orchestration.service.js';

export interface OrchestrationHttpService {
  execute(input: OrchestrationRequest & { correlationId?: string }): Promise<OrchestrationResult>;
  getStatus(taskId: string, correlationId?: string): Promise<OrchestrationResult | null>;
  cancel(taskId: string): Promise<OrchestrationResult>;
}

export interface HttpServerOptions {
  staticRoot?: string;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function createOrchestrationHttpServer(service: OrchestrationHttpService, options: HttpServerOptions = {}) {
  const staticRoot = options.staticRoot ? resolve(options.staticRoot) : undefined;

  return createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders()); res.end(); return; }
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const correlationId = req.headers['x-correlation-id']?.toString() || `corr-http-${Date.now()}`;
      if (req.method === 'POST' && url.pathname === '/api/tasks') {
        const body = await readJson(req);
        if (!isTaskRequest(body)) return sendError(res, 400, 'INVALID_REQUEST', 'Invalid task request', correlationId);
        const task = body as Record<string, unknown>;
        const result = await service.execute({
          taskId: task.taskId as string,
          title: task.title as string,
          role: task.role as any,
          instructions: task.instructions as string,
          dataSensitivity: task.dataSensitivity as any,
          createdBy: typeof task.createdBy === 'string' ? task.createdBy : 'api',
          correlationId,
          idempotencyKey: req.headers['idempotency-key']?.toString(),
        });
        const httpStatus = result.status === 'REJECTED' || result.error?.code === 'POLICY_REJECTED' ? 422 : result.error?.code === 'REGISTRY_ERROR' ? 503 : 202;
        return sendResult(res, httpStatus, result, correlationId);
      }
      if (req.method === 'GET' && url.pathname === '/api/tasks') {
        const taskId = url.searchParams.get('taskId');
        if (!taskId) return sendError(res, 400, 'INVALID_REQUEST', 'taskId is required', correlationId);
        const result = await service.getStatus(taskId, correlationId);
        return result ? sendResult(res, 200, result, correlationId) : sendError(res, 404, 'NOT_FOUND', 'Task not found', correlationId);
      }
      const match = url.pathname.match(/^\/api\/tasks\/([^/]+)\/cancel$/);
      if (req.method === 'POST' && match) {
        const result = await service.cancel(decodeURIComponent(match[1]));
        return sendResult(res, result.error?.code === 'NOT_FOUND' ? 404 : result.error?.code === 'INVALID_STATE' ? 409 : 202, result, correlationId);
      }
      if (staticRoot && (req.method === 'GET' || req.method === 'HEAD') && !url.pathname.startsWith('/api/')) {
        if (await serveStatic(res, staticRoot, url.pathname, req.method === 'HEAD')) return;
      }
      sendError(res, 404, 'NOT_FOUND', 'Route not found', correlationId);
    } catch (error) { sendError(res, 400, 'INVALID_REQUEST', error instanceof Error ? error.message : 'Invalid request', 'unknown'); }
  });
}

async function serveStatic(res: ServerResponse, staticRoot: string, pathname: string, headOnly: boolean): Promise<boolean> {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = resolve(staticRoot, normalize(relative));
  const rootWithSep = staticRoot.endsWith(sep) ? staticRoot : `${staticRoot}${sep}`;
  if (candidate !== staticRoot && !candidate.startsWith(rootWithSep)) {
    res.writeHead(404, { ...corsHeaders(), 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return true;
  }
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return false;
  const type = CONTENT_TYPES[extname(candidate).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { ...corsHeaders(), 'content-type': type });
  if (headOnly) { res.end(); return true; }
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(candidate);
    stream.on('error', reject);
    stream.on('end', () => resolvePromise());
    stream.pipe(res);
  });
  return true;
}

function readJson(req: IncomingMessage): Promise<unknown> { return new Promise((resolve, reject) => { let data = ''; req.on('data', (chunk) => { data += chunk; if (data.length > 1_000_000) reject(new Error('Request body too large')); }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Malformed JSON')); } }); req.on('error', reject); }); }
function isTaskRequest(value: any): boolean {
  return value &&
    typeof value.taskId === 'string' && value.taskId.length > 0 &&
    typeof value.title === 'string' && value.title.length > 0 &&
    ['planner','architect','researcher','coder','tester','reviewer','docs'].includes(value.role) &&
    typeof value.instructions === 'string' && value.instructions.length > 0 &&
    (!value.dataSensitivity || ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'].includes(value.dataSensitivity));
}
function corsHeaders(): Record<string, string> {
  const origin = process.env.PSEE_CORS_ORIGIN;
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Content-Type, X-Correlation-ID, Idempotency-Key',
  };
}
function sendResult(res: ServerResponse, status: number, result: OrchestrationResult, correlationId: string) { res.writeHead(status, { ...corsHeaders(), 'content-type': 'application/json', 'x-correlation-id': result.correlationId || correlationId }); res.end(JSON.stringify(result)); }
function sendError(res: ServerResponse, status: number, code: string, message: string, correlationId: string) { res.writeHead(status, { ...corsHeaders(), 'content-type': 'application/json', 'x-correlation-id': correlationId }); res.end(JSON.stringify({ error: { code, message, correlationId }, correlationId })); }

export function adaptOrchestrationService(service: OrchestrationService): OrchestrationHttpService {
  return { execute: (input) => service.execute(input), cancel: (taskId) => service.cancel(taskId), getStatus: async (taskId, correlationId) => { const task = service.getTask(taskId); return task ? { taskId, executionId: '', correlationId: correlationId ?? `corr-${taskId}`, status: task.status as OrchestrationResult['status'] } : null; } };
}
