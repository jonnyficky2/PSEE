import type { CreateTaskRequest, ErrorResponse, TaskResponse } from './types.js';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly details: ErrorResponse, message = details.error.message) { super(message); }
}

export class PseeApiClient {
  constructor(private readonly baseUrl = '/api') {}

  async submitTask(request: CreateTaskRequest, options: { correlationId?: string; idempotencyKey?: string } = {}): Promise<TaskResponse> {
    return this.request('/tasks', { method: 'POST', body: JSON.stringify(request), headers: this.headers(options) });
  }
  async getTask(taskId: string, correlationId?: string): Promise<TaskResponse> {
    return this.request(`/tasks?taskId=${encodeURIComponent(taskId)}`, { headers: this.headers({ correlationId }) });
  }
  async cancelTask(taskId: string, correlationId?: string): Promise<TaskResponse> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST', headers: this.headers({ correlationId }) });
  }

  private headers(options: { correlationId?: string; idempotencyKey?: string }) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.correlationId) headers['X-Correlation-ID'] = options.correlationId;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    return headers;
  }
  private async request(path: string, init: RequestInit): Promise<TaskResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    const body = await response.json() as TaskResponse & ErrorResponse;
    if (!response.ok) throw new ApiError(response.status, body as ErrorResponse);
    return body as TaskResponse;
  }
}
