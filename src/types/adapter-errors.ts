/**
 * Adapter Error Normalization & Sanitization
 */

export enum AdapterFailure {
  RATE_LIMITED = 'RATE_LIMITED',
  CREDITS_REQUIRED = 'CREDITS_REQUIRED',
  AUTH_FAILED = 'AUTH_FAILED',
  SERVER_ERROR = 'SERVER_ERROR',
  MALFORMED_RESPONSE = 'MALFORMED_RESPONSE',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export class AdapterError extends Error {
  constructor(
    public readonly category: AdapterFailure,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export function sanitize(input: string): string {
  if (!input) return input;
  
  // 1. Redact Bearer tokens: Bearer <key>
  let output = input.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');
  
  // 2. Redact common API key patterns (e.g., sk-..., ag-...)
  output = output.replace(/\b(sk|ag)-[a-zA-Z0-9_-]+\b/gi, '[REDACTED_KEY]');
  
  return output;
}
