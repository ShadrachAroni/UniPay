export class UniPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ProviderNotFoundError extends UniPayError {
  constructor(public readonly adapterKey: string) {
    super(`Payment provider adapter not found for key: '${adapterKey}'`);
  }
}

export class ProviderUnavailableError extends UniPayError {
  constructor(public readonly adapterKey: string, message: string = 'Provider service is unavailable') {
    super(`[${adapterKey}] ${message}`);
  }
}

export class ProviderTimeoutError extends UniPayError {
  constructor(public readonly adapterKey: string, timeoutMs: number) {
    super(`[${adapterKey}] Operation timed out after ${timeoutMs}ms`);
  }
}

export class UnsupportedCapabilityError extends UniPayError {
  constructor(public readonly adapterKey: string, public readonly capability: string) {
    super(`[${adapterKey}] Feature/capability '${capability}' is not supported by this provider`);
  }
}

export class InvalidProviderResponseError extends UniPayError {
  constructor(public readonly adapterKey: string, message: string) {
    super(`[${adapterKey}] Invalid provider response: ${message}`);
  }
}

export class CircuitOpenError extends UniPayError {
  constructor(public readonly adapterKey: string) {
    super(`[${adapterKey}] Circuit breaker is OPEN. Calls are failing fast to prevent cascading failures.`);
  }
}

export class CapabilityMismatchError extends UniPayError {
  constructor(public readonly adapterKey: string, public readonly mismatches: string[]) {
    super(`[${adapterKey}] Rail configuration capabilities mismatch with adapter capability: ${mismatches.join(', ')}`);
  }
}

export class UnimplementedPhase3Error extends UniPayError {
  constructor(featureName: string) {
    super(`Phase 3 Feature '${featureName}' is not implemented in Phase 2.`);
  }
}
