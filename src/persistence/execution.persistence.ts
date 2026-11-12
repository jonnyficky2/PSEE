import type { PseeDatabase } from '../db/database.js';

export interface TaskRecord {
  id: string;
  title: string;
  status: string;
  priority: number;
  workspaceRef: string;
  createdBy: string;
}

export interface ExecutionRecord {
  id: string;
  taskId: string;
  agentId: string;
  runNumber: number;
  status: string;
  selectedConnectionId?: string | null;
  selectedModelId?: string | null;
  errorCode?: string | null;
  correlationId: string;
}

export interface RoutingLogRecord {
  id: string;
  executionId: string;
  modelId?: string | null;
  connectionId?: string | null;
  policyVersion: string;
  selectionReason: string;
  fallbackFromLogId?: string | null;
  status: string;
}

export interface UsageRecord {
  id: string;
  executionId: string;
  providerId: string;
  modelId: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCost?: number | null;
  currency?: string;
  measurementSource: string;
}

export interface AuditEventRecord {
  id: string;
  actorRef: string;
  action: string;
  targetType: string;
  targetId: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

export class ExecutionPersistenceService {
  constructor(private readonly pseeDb: PseeDatabase) {}

  createTask(task: TaskRecord): void {
    this.pseeDb.rawDb.prepare(`
      INSERT INTO tasks (id, title, status, priority, workspace_ref, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(task.id, task.title, task.status, task.priority, task.workspaceRef, task.createdBy);
  }

  getTask(id: string): TaskRecord | null {
    const row = this.pseeDb.rawDb.prepare(`
      SELECT id, title, status, priority, workspace_ref AS workspaceRef, created_by AS createdBy
      FROM tasks WHERE id = ?
    `).get(id) as TaskRecord | undefined;
    return row ?? null;
  }

  startExecution(execution: ExecutionRecord): void {
    this.pseeDb.rawDb.prepare(`
      INSERT INTO agent_executions (
        id, task_id, agent_id, run_number, status, selected_connection_id,
        selected_model_id, error_code, correlation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      execution.id, execution.taskId, execution.agentId, execution.runNumber,
      execution.status, execution.selectedConnectionId ?? null,
      execution.selectedModelId ?? null, execution.errorCode ?? null,
      execution.correlationId,
    );
  }

  recordRoutingLog(log: RoutingLogRecord): void {
    this.pseeDb.rawDb.prepare(`
      INSERT INTO routing_logs (
        id, execution_id, model_id, connection_id, policy_version,
        selection_reason, fallback_from_log_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.id, log.executionId, log.modelId ?? null, log.connectionId ?? null,
      log.policyVersion, log.selectionReason, log.fallbackFromLogId ?? null, log.status,
    );
  }

  recordUsage(usage: UsageRecord): void {
    this.pseeDb.rawDb.prepare(`
      INSERT INTO usage_records (
        id, execution_id, provider_id, model_id, input_tokens, output_tokens,
        total_tokens, estimated_cost, currency, measurement_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usage.id, usage.executionId, usage.providerId, usage.modelId,
      usage.inputTokens ?? null, usage.outputTokens ?? null, usage.totalTokens ?? null,
      usage.estimatedCost ?? null, usage.currency ?? 'USD', usage.measurementSource,
    );
  }

  updateTaskStatus(id: string, status: string): void {
    this.pseeDb.rawDb.prepare(`UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
  }

  updateExecutionStatus(id: string, status: string, errorCode?: string | null): void {
    this.pseeDb.rawDb.prepare(`UPDATE agent_executions SET status = ?, error_code = ?, finished_at = CASE WHEN ? IN ('SUCCESS', 'FAILED', 'TIMEOUT', 'INTERRUPTED') THEN datetime('now') ELSE finished_at END WHERE id = ?`).run(status, errorCode ?? null, status, id);
  }

  recordAuditEvent(event: AuditEventRecord): void {
    this.pseeDb.rawDb.prepare(`
      INSERT INTO audit_events (
        id, actor_ref, action, target_type, target_id, correlation_id, sanitized_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, event.actorRef, event.action, event.targetType, event.targetId,
      event.correlationId, event.metadata ? JSON.stringify(event.metadata) : null,
    );
  }
}
