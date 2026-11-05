import type { PseeDatabase } from '../db/database.js';
import type { ModelLifecycleState } from '../types/index.js';

export interface ModelEntity {
  id: string;
  providerId: string;
  modelKey: string;
  displayName: string;
  status: ModelLifecycleState;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  enabled: boolean;
  source: 'user_reported' | 'discovered' | 'verified';
}

export class ModelRegistryService {
  constructor(private readonly pseeDb: PseeDatabase) {}

  registerProvider(
    id: string,
    providerKey: string,
    displayName: string,
    providerType: 'cloud' | 'local' | 'gateway',
    status: string = 'ACTIVE'
  ): void {
    const db = this.pseeDb.rawDb;
    const stmt = db.prepare(`
      INSERT INTO ai_providers (id, provider_key, display_name, provider_type, status, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(provider_key) DO UPDATE SET
        display_name = excluded.display_name,
        provider_type = excluded.provider_type,
        status = excluded.status,
        updated_at = datetime('now')
    `);
    stmt.run(id, providerKey, displayName, providerType, status);
  }

  registerModel(model: ModelEntity): void {
    const db = this.pseeDb.rawDb;
    const stmt = db.prepare(`
      INSERT INTO ai_models (
        id, provider_id, model_key, display_name, status,
        context_window, max_output_tokens, enabled, source, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(provider_id, model_key) DO UPDATE SET
        display_name = excluded.display_name,
        status = excluded.status,
        context_window = COALESCE(excluded.context_window, ai_models.context_window),
        max_output_tokens = COALESCE(excluded.max_output_tokens, ai_models.max_output_tokens),
        enabled = excluded.enabled,
        source = excluded.source,
        updated_at = datetime('now')
    `);
    stmt.run(
      model.id,
      model.providerId,
      model.modelKey,
      model.displayName,
      model.status,
      model.contextWindow,
      model.maxOutputTokens,
      model.enabled ? 1 : 0,
      model.source
    );
  }

  recordHealthCheck(params: {
    id: string;
    modelId: string;
    connectionId?: string | null;
    status: string;
    normalizedErrorCode?: string | null;
    sanitizedDetail?: string | null;
    latencyMs?: number | null;
    evidenceSource?: string;
  }): void {
    const db = this.pseeDb.rawDb;
    const stmt = db.prepare(`
      INSERT INTO model_health_checks (
        id, model_id, connection_id, status, normalized_error_code,
        sanitized_detail, latency_ms, evidence_source, tested_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(
      params.id,
      params.modelId,
      params.connectionId ?? null,
      params.status,
      params.normalizedErrorCode ?? null,
      params.sanitizedDetail ?? null,
      params.latencyMs ?? null,
      params.evidenceSource ?? 'runtime_healthcheck'
    );
  }

  getVerifiedModels(): ModelEntity[] {
    const db = this.pseeDb.rawDb;
    const stmt = db.prepare(`
      SELECT id, provider_id as providerId, model_key as modelKey,
             display_name as displayName, status, context_window as contextWindow,
             max_output_tokens as maxOutputTokens, enabled, source
      FROM ai_models
      WHERE status IN ('CONNECTIVITY_VERIFIED', 'QUALIFIED') AND enabled = 1
    `);
    const rows = stmt.all() as Array<{
      id: string;
      providerId: string;
      modelKey: string;
      displayName: string;
      status: ModelLifecycleState;
      contextWindow: number | null;
      maxOutputTokens: number | null;
      enabled: number;
      source: 'user_reported' | 'discovered' | 'verified';
    }>;

    return rows.map((r) => ({
      ...r,
      enabled: r.enabled === 1,
    }));
  }
}
