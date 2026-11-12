import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { OrchestrationRequest, OrchestrationResult, OrchestrationService } from '../orchestration/orchestration.service.js';

export interface OrchestrationHttpService {
  execute(input: OrchestrationRequest & { correlationId?: string }): Promise<OrchestrationResult>;
  getStatus(taskId: string, correlationId?: string): Promise<OrchestrationResult | null>;
  cancel(taskId: string): Promise<OrchestrationResult>;
}

export function createOrchestrationHttpServer(service: OrchestrationHttpService) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const correlationId = req.headers['x-correlation-id']?.toString() || `corr-http-${Date.now()}`;
      if (req.method === 'POST' && url.pathname === '/api/tasks') {
        const body = await readJson(req);
        if (!isTaskRequest(body)) return sendError(res, 400, 'INVALID_REQUEST', 'Invalid task request', correlationId);
        const task = body as Record<string, unknown>;
        const result = await service.execute({ ...task as any, createdBy: typeof task.createdBy === 'string' ? task.createdBy : 'api', availableLocalModels: Array.isArray(task.availableLocalModels) ? task.availableLocalModels as string[] : [], availableGatewayModels: Array.isArray(task.availableGatewayModels) ? task.availableGatewayModels as string[] : [], correlationId, idempotencyKey: req.headers['idempotency-key']?.toString() });
        return sendResult(res, result.status === 'REJECTED' ? 422 : 202, result, correlationId);
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
      sendError(res, 404, 'NOT_FOUND', 'Route not found', correlationId);
    } catch (error) { sendError(res, 400, 'INVALID_REQUEST', error instanceof Error ? error.message : 'Invalid request', 'unknown'); }
  });
}

function readJson(req: IncomingMessage): Promise<unknown> { return new Promise((resolve, reject) => { let data = ''; req.on('data', (chunk) => { data += chunk; if (data.length > 1_000_000) reject(new Error('Request body too large')); }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Malformed JSON')); } }); req.on('error', reject); }); }
function isTaskRequest(value: any): boolean { return value && typeof value.taskId === 'string' && value.taskId.length > 0 && typeof value.title === 'string' && value.title.length > 0 && ['planner','architect','researcher','coder','tester','reviewer','docs'].includes(value.role) && typeof value.instructions === 'string' && value.instructions.length > 0; }
function sendResult(res: ServerResponse, status: number, result: OrchestrationResult, correlationId: string) { res.writeHead(status, { 'content-type': 'application/json', 'x-correlation-id': result.correlationId || correlationId }); res.end(JSON.stringify(result)); }
function sendError(res: ServerResponse, status: number, code: string, message: string, correlationId: string) { res.writeHead(status, { 'content-type': 'application/json', 'x-correlation-id': correlationId }); res.end(JSON.stringify({ error: { code, message, correlationId }, correlationId })); }

export function adaptOrchestrationService(service: OrchestrationService): OrchestrationHttpService {
  return { execute: (input) => service.execute(input), cancel: (taskId) => service.cancel(taskId), getStatus: async (taskId, correlationId) => { const task = service.getTask(taskId); return task ? { taskId, executionId: '', correlationId: correlationId ?? `corr-${taskId}`, status: task.status as OrchestrationResult['status'] } : null; } };
}
