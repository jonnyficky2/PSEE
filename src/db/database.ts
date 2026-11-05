import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface DatabaseOptions {
  dbPath?: string;
}

export class PseeDatabase {
  private db: Database.Database;

  constructor(options: DatabaseOptions = {}) {
    const dbPath = options.dbPath || '.psee/psee_state.sqlite';
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.configurePragmas();
    this.initializeSchema();
  }

  private configurePragmas(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
  }

  private initializeSchema(): void {
    this.db.exec(`
      -- 1. AI Providers
      CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        provider_key TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        provider_type TEXT CHECK(provider_type IN ('cloud', 'local', 'gateway')) NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 2. AI Accounts
      CREATE TABLE IF NOT EXISTS ai_accounts (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
        account_ref TEXT NOT NULL,
        masked_label TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 3. Provider Connections
      CREATE TABLE IF NOT EXISTS provider_connections (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
        account_id TEXT REFERENCES ai_accounts(id) ON DELETE SET NULL,
        adapter_type TEXT CHECK(adapter_type IN ('gateway', 'direct', 'local')) NOT NULL,
        config_ref TEXT NOT NULL,
        base_url_ref TEXT,
        status TEXT NOT NULL,
        last_verified_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 4. AI Models
      CREATE TABLE IF NOT EXISTS ai_models (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
        model_key TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT CHECK(status IN ('UNKNOWN', 'CONNECTIVITY_VERIFIED', 'QUALIFIED', 'QUARANTINED', 'DISABLED')) NOT NULL,
        context_window INTEGER,
        max_output_tokens INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        source TEXT CHECK(source IN ('user_reported', 'discovered', 'verified')) NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(provider_id, model_key)
      );

      -- 5. Model Capabilities
      CREATE TABLE IF NOT EXISTS model_capabilities (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
        capability_key TEXT NOT NULL,
        status TEXT CHECK(status IN ('unknown', 'pass', 'fail')) NOT NULL,
        benchmark_version TEXT,
        evidence_ref TEXT,
        tested_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(model_id, capability_key)
      );

      -- 6. Model Health Checks
      CREATE TABLE IF NOT EXISTS model_health_checks (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
        connection_id TEXT REFERENCES provider_connections(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        normalized_error_code TEXT,
        sanitized_detail TEXT,
        latency_ms INTEGER,
        evidence_source TEXT,
        tested_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 7. Provider Health Checks
      CREATE TABLE IF NOT EXISTS provider_health_checks (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
        connection_id TEXT REFERENCES provider_connections(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        sanitized_detail TEXT,
        tested_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 8. Routing Policies
      CREATE TABLE IF NOT EXISTS routing_policies (
        id TEXT PRIMARY KEY,
        policy_key TEXT UNIQUE NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 9. Routing Rules
      CREATE TABLE IF NOT EXISTS routing_rules (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL REFERENCES routing_policies(id) ON DELETE CASCADE,
        task_class TEXT NOT NULL,
        required_capabilities TEXT, -- JSON array
        allowed_provider_ids TEXT, -- JSON array
        data_classification_max TEXT NOT NULL,
        priority_config TEXT, -- JSON object
        approval_required INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      -- 10. Agent Definitions
      CREATE TABLE IF NOT EXISTS agent_definitions (
        id TEXT PRIMARY KEY,
        agent_key TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        role_description TEXT NOT NULL,
        default_task_class TEXT NOT NULL,
        permission_profile TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      -- 11. Tasks
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description_ref TEXT,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        workspace_ref TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 12. Agent Executions
      CREATE TABLE IF NOT EXISTS agent_executions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL REFERENCES agent_definitions(id) ON DELETE RESTRICT,
        run_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        selected_connection_id TEXT REFERENCES provider_connections(id),
        selected_model_id TEXT REFERENCES ai_models(id),
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        error_code TEXT,
        correlation_id TEXT NOT NULL
      );

      -- 13. Task Checkpoints
      CREATE TABLE IF NOT EXISTS task_checkpoints (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        execution_id TEXT REFERENCES agent_executions(id) ON DELETE SET NULL,
        checkpoint_number INTEGER NOT NULL,
        workspace_ref TEXT NOT NULL,
        git_branch TEXT NOT NULL,
        git_commit_sha TEXT NOT NULL,
        dirty_worktree_summary TEXT,
        completed_steps TEXT, -- JSON array
        pending_steps TEXT, -- JSON array
        changed_files TEXT, -- JSON array
        test_summary TEXT, -- JSON object
        artifact_refs TEXT, -- JSON array
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(task_id, checkpoint_number)
      );

      -- 14. Routing Logs
      CREATE TABLE IF NOT EXISTS routing_logs (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
        model_id TEXT REFERENCES ai_models(id),
        connection_id TEXT REFERENCES provider_connections(id),
        policy_version TEXT NOT NULL,
        selection_reason TEXT NOT NULL,
        fallback_from_log_id TEXT REFERENCES routing_logs(id),
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 15. Usage Records
      CREATE TABLE IF NOT EXISTS usage_records (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL REFERENCES ai_providers(id),
        model_id TEXT NOT NULL REFERENCES ai_models(id),
        input_tokens INTEGER,
        output_tokens INTEGER,
        total_tokens INTEGER,
        estimated_cost REAL,
        currency TEXT DEFAULT 'USD',
        measurement_source TEXT NOT NULL,
        recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 16. Provider Incidents & Audit Events
      CREATE TABLE IF NOT EXISTS provider_incidents (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
        connection_id TEXT REFERENCES provider_connections(id) ON DELETE SET NULL,
        model_id TEXT REFERENCES ai_models(id) ON DELETE SET NULL,
        incident_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        opened_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at TEXT,
        sanitized_summary TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        actor_ref TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        sanitized_metadata TEXT, -- JSON object
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Indexes for High Performance Queries
      CREATE INDEX IF NOT EXISTS idx_agent_executions_task ON agent_executions(task_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task ON task_checkpoints(task_id, checkpoint_number);
      CREATE INDEX IF NOT EXISTS idx_routing_logs_exec ON routing_logs(execution_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_model_health_model ON model_health_checks(model_id, tested_at);
      CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at, actor_ref);
    `);
  }

  get rawDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
