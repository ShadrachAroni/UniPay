"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentOptionsService = void 0;
const payment_rail_js_1 = require("../domain/payment-rail.js");
const payment_errors_js_1 = require("../errors/payment.errors.js");
const logger_js_1 = require("../utils/logger.js");
const resilient_adapter_wrapper_js_1 = require("../resilience/resilient-adapter.wrapper.js");
class PaymentOptionsService {
    railsRepo;
    registry;
    constructor(railsRepo, registry) {
        this.railsRepo = railsRepo;
        this.registry = registry;
    }
    async getAvailableOptions(req) {
        const matchingRails = await this.railsRepo.filterAvailable({
            currency: req.currency,
            country: req.country,
            amount: req.amount,
        });
        const availableOptions = [];
        for (const rail of matchingRails) {
            if (!this.registry.has(rail.adapter_key)) {
                logger_js_1.logger.warn(`Rail '${rail.name}' is enabled in DB but no adapter is registered for key '${rail.adapter_key}'`, {
                    adapter_key: rail.adapter_key,
                });
                continue;
            }
            const adapter = this.registry.get(rail.adapter_key);
            // Validate capability consistency
            const validation = (0, payment_rail_js_1.validateRailCapabilityConsistency)(rail, adapter);
            if (!validation.valid) {
                logger_js_1.logger.error(`Capability mismatch for rail '${rail.adapter_key}'`, {
                    adapter_key: rail.adapter_key,
                    mismatches: validation.mismatches,
                });
                throw new payment_errors_js_1.CapabilityMismatchError(rail.adapter_key, validation.mismatches);
            }
            // Check if adapter is wrapped with a circuit breaker and circuit is OPEN
            if (adapter instanceof resilient_adapter_wrapper_js_1.ResilientPaymentAdapter) {
                if (adapter.circuitBreaker.getState() === 'OPEN') {
                    logger_js_1.logger.warn(`Adapter '${rail.adapter_key}' circuit breaker is OPEN. Excluding from checkout options.`, {
                        adapter_key: rail.adapter_key,
                    });
                    continue;
                }
            }
            availableOptions.push({
                id: rail.id,
                name: rail.name,
                adapter_key: rail.adapter_key,
                supported_currencies: rail.supported_currencies,
                min_amount: rail.min_amount,
                max_amount: rail.max_amount,
            });
        }
        return availableOptions;
    }
}
exports.PaymentOptionsService = PaymentOptionsService;
