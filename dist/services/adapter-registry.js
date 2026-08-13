"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterRegistry = void 0;
const payment_errors_js_1 = require("../errors/payment.errors.js");
const logger_js_1 = require("../utils/logger.js");
class AdapterRegistry {
    adapters = new Map();
    register(key, adapter) {
        if (this.adapters.has(key)) {
            logger_js_1.logger.warn(`Overwriting existing payment provider adapter for key: '${key}'`);
        }
        this.adapters.set(key, adapter);
        logger_js_1.logger.info(`Registered payment provider adapter '${adapter.name()}' under key '${key}'`, {
            adapter_key: key,
        });
    }
    get(key) {
        const adapter = this.adapters.get(key);
        if (!adapter) {
            throw new payment_errors_js_1.ProviderNotFoundError(key);
        }
        return adapter;
    }
    has(key) {
        return this.adapters.has(key);
    }
    getAllKeys() {
        return Array.from(this.adapters.keys());
    }
    clear() {
        this.adapters.clear();
    }
}
exports.AdapterRegistry = AdapterRegistry;
