/**
 * PSEE — Personal System Execution Environment
 * Main Entry Point & Module Exports
 */

export * from './types/index.js';
export * from './adapters/ollama.adapter.js';
export * from './adapters/ninerouter.adapter.js';
export * from './adapters/opencode.adapter.js';
export * from './db/database.js';
export * from './registry/model.registry.js';
export * from './isolation/worktree.manager.js';
export * from './checkpoint/checkpoint.engine.js';
export * from './policy/policy.engine.js';
export * from './persistence/execution.persistence.js';
export * from './orchestration/orchestration.service.js';
export * from './api/http-server.js';
export * from './runtime/bootstrap.js';

export const PSEE_VERSION = '0.1.0';
export const PSEE_DESCRIPTION = 'Free-First Multi-Agent Orchestration Architecture';
