"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResilientPaymentAdapter = void 0;
const circuit_breaker_js_1 = require("./circuit-breaker.js");
const retry_js_1 = require("./retry.js");
const logger_js_1 = require("../utils/logger.js");
class ResilientPaymentAdapter {
    innerAdapter;
    circuitBreaker;
    retryOptions;
    constructor(innerAdapter, config = {}) {
        this.innerAdapter = innerAdapter;
        const adapterKey = innerAdapter.name();
        this.circuitBreaker = new circuit_breaker_js_1.CircuitBreaker({
            adapterKey,
            ...config.circuitBreaker,
        });
        this.retryOptions = {
            adapterKey,
            ...config.retry,
        };
    }
    name() {
        return this.innerAdapter.name();
    }
    capabilities() {
        return this.innerAdapter.capabilities();
    }
    async createPayment(request) {
        const start = Date.now();
        return this.circuitBreaker.execute(async () => {
            return (0, retry_js_1.retryWithBackoffAndJitter)('createPayment', async () => {
                const res = await this.innerAdapter.createPayment(request);
                logger_js_1.logger.info(`createPayment succeeded on adapter '${this.name()}'`, {
                    adapter_key: this.name(),
                    operation: 'createPayment',
                    duration_ms: Date.now() - start,
                    outcome: 'success',
                    circuit_state: this.circuitBreaker.getState(),
                });
                return res;
            }, this.retryOptions);
        });
    }
    async getStatus(providerReference) {
        const start = Date.now();
        return this.circuitBreaker.execute(async () => {
            return (0, retry_js_1.retryWithBackoffAndJitter)('getStatus', async () => {
                const res = await this.innerAdapter.getStatus(providerReference);
                logger_js_1.logger.info(`getStatus succeeded on adapter '${this.name()}'`, {
                    adapter_key: this.name(),
                    operation: 'getStatus',
                    duration_ms: Date.now() - start,
                    outcome: 'success',
                    circuit_state: this.circuitBreaker.getState(),
                });
                return res;
            }, this.retryOptions);
        });
    }
    async refund(request) {
        const start = Date.now();
        return this.circuitBreaker.execute(async () => {
            return (0, retry_js_1.retryWithBackoffAndJitter)('refund', async () => {
                const res = await this.innerAdapter.refund(request);
                logger_js_1.logger.info(`refund succeeded on adapter '${this.name()}'`, {
                    adapter_key: this.name(),
                    operation: 'refund',
                    duration_ms: Date.now() - start,
                    outcome: 'success',
                    circuit_state: this.circuitBreaker.getState(),
                });
                return res;
            }, this.retryOptions);
        });
    }
    async disburse(request) {
        const start = Date.now();
        return this.circuitBreaker.execute(async () => {
            return (0, retry_js_1.retryWithBackoffAndJitter)('disburse', async () => {
                const res = await this.innerAdapter.disburse(request);
                logger_js_1.logger.info(`disburse succeeded on adapter '${this.name()}'`, {
                    adapter_key: this.name(),
                    operation: 'disburse',
                    duration_ms: Date.now() - start,
                    outcome: 'success',
                    circuit_state: this.circuitBreaker.getState(),
                });
                return res;
            }, this.retryOptions);
        });
    }
    normalize(payload) {
        return this.innerAdapter.normalize(payload);
    }
    verifyWebhook(req) {
        return this.innerAdapter.verifyWebhook(req);
    }
}
exports.ResilientPaymentAdapter = ResilientPaymentAdapter;
