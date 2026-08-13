"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
const payment_errors_js_1 = require("../errors/payment.errors.js");
const logger_js_1 = require("../utils/logger.js");
class CircuitBreaker {
    adapterKey;
    state = 'CLOSED';
    failureCount = 0;
    successCount = 0;
    lastStateChange = Date.now();
    failureThreshold;
    resetTimeoutMs;
    successThreshold;
    constructor(options) {
        this.adapterKey = options.adapterKey;
        this.failureThreshold = options.failureThreshold ?? 5;
        this.resetTimeoutMs = options.resetTimeoutMs ?? 10000;
        this.successThreshold = options.successThreshold ?? 1;
    }
    getState() {
        if (this.state === 'OPEN') {
            const elapsed = Date.now() - this.lastStateChange;
            if (elapsed >= this.resetTimeoutMs) {
                this.transitionTo('HALF_OPEN');
            }
        }
        return this.state;
    }
    transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;
        this.lastStateChange = Date.now();
        if (newState === 'CLOSED') {
            this.failureCount = 0;
            this.successCount = 0;
        }
        else if (newState === 'HALF_OPEN') {
            this.successCount = 0;
        }
        else if (newState === 'OPEN') {
            this.failureCount = 0;
        }
        logger_js_1.logger.info(`Circuit breaker state changed: ${oldState} -> ${newState}`, {
            adapter_key: this.adapterKey,
            circuit_state: newState,
        });
    }
    async execute(fn) {
        const currentState = this.getState();
        if (currentState === 'OPEN') {
            logger_js_1.logger.warn(`Circuit breaker OPEN for adapter '${this.adapterKey}'. Failing fast.`, {
                adapter_key: this.adapterKey,
                outcome: 'circuit_open',
                circuit_state: 'OPEN',
            });
            throw new payment_errors_js_1.CircuitOpenError(this.adapterKey);
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (err) {
            this.onFailure(err);
            throw err;
        }
    }
    onSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.transitionTo('CLOSED');
            }
        }
        else if (this.state === 'CLOSED') {
            this.failureCount = 0;
        }
    }
    onFailure(err) {
        if (this.state === 'HALF_OPEN') {
            this.transitionTo('OPEN');
        }
        else if (this.state === 'CLOSED') {
            this.failureCount++;
            if (this.failureCount >= this.failureThreshold) {
                this.transitionTo('OPEN');
            }
        }
    }
    // Force state for testing
    forceState(state) {
        this.transitionTo(state);
    }
}
exports.CircuitBreaker = CircuitBreaker;
