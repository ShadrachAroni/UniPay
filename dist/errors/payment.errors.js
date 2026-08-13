"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnimplementedPhase3Error = exports.CapabilityMismatchError = exports.CircuitOpenError = exports.InvalidProviderResponseError = exports.UnsupportedCapabilityError = exports.ProviderTimeoutError = exports.ProviderUnavailableError = exports.ProviderNotFoundError = exports.UniPayError = void 0;
class UniPayError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.UniPayError = UniPayError;
class ProviderNotFoundError extends UniPayError {
    adapterKey;
    constructor(adapterKey) {
        super(`Payment provider adapter not found for key: '${adapterKey}'`);
        this.adapterKey = adapterKey;
    }
}
exports.ProviderNotFoundError = ProviderNotFoundError;
class ProviderUnavailableError extends UniPayError {
    adapterKey;
    constructor(adapterKey, message = 'Provider service is unavailable') {
        super(`[${adapterKey}] ${message}`);
        this.adapterKey = adapterKey;
    }
}
exports.ProviderUnavailableError = ProviderUnavailableError;
class ProviderTimeoutError extends UniPayError {
    adapterKey;
    constructor(adapterKey, timeoutMs) {
        super(`[${adapterKey}] Operation timed out after ${timeoutMs}ms`);
        this.adapterKey = adapterKey;
    }
}
exports.ProviderTimeoutError = ProviderTimeoutError;
class UnsupportedCapabilityError extends UniPayError {
    adapterKey;
    capability;
    constructor(adapterKey, capability) {
        super(`[${adapterKey}] Feature/capability '${capability}' is not supported by this provider`);
        this.adapterKey = adapterKey;
        this.capability = capability;
    }
}
exports.UnsupportedCapabilityError = UnsupportedCapabilityError;
class InvalidProviderResponseError extends UniPayError {
    adapterKey;
    constructor(adapterKey, message) {
        super(`[${adapterKey}] Invalid provider response: ${message}`);
        this.adapterKey = adapterKey;
    }
}
exports.InvalidProviderResponseError = InvalidProviderResponseError;
class CircuitOpenError extends UniPayError {
    adapterKey;
    constructor(adapterKey) {
        super(`[${adapterKey}] Circuit breaker is OPEN. Calls are failing fast to prevent cascading failures.`);
        this.adapterKey = adapterKey;
    }
}
exports.CircuitOpenError = CircuitOpenError;
class CapabilityMismatchError extends UniPayError {
    adapterKey;
    mismatches;
    constructor(adapterKey, mismatches) {
        super(`[${adapterKey}] Rail configuration capabilities mismatch with adapter capability: ${mismatches.join(', ')}`);
        this.adapterKey = adapterKey;
        this.mismatches = mismatches;
    }
}
exports.CapabilityMismatchError = CapabilityMismatchError;
class UnimplementedPhase3Error extends UniPayError {
    constructor(featureName) {
        super(`Phase 3 Feature '${featureName}' is not implemented in Phase 2.`);
    }
}
exports.UnimplementedPhase3Error = UnimplementedPhase3Error;
