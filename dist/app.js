"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const payment_rails_repository_js_1 = require("./repository/payment-rails.repository.js");
const adapter_registry_js_1 = require("./services/adapter-registry.js");
const seeded_adapter_js_1 = require("./adapters/seeded.adapter.js");
const loop_adapter_js_1 = require("./adapters/loop.adapter.js");
const resilient_adapter_wrapper_js_1 = require("./resilience/resilient-adapter.wrapper.js");
const payment_options_service_js_1 = require("./services/payment-options.service.js");
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Initialize Repositories & Adapters
    const railsRepo = new payment_rails_repository_js_1.PaymentRailsRepository([payment_rails_repository_js_1.defaultSeededRail, payment_rails_repository_js_1.defaultLoopRail]);
    const registry = new adapter_registry_js_1.AdapterRegistry();
    const seededAdapter = new seeded_adapter_js_1.SeededPaymentAdapter();
    const resilientSeeded = new resilient_adapter_wrapper_js_1.ResilientPaymentAdapter(seededAdapter);
    const loopAdapter = new loop_adapter_js_1.LoopAdapter();
    const resilientLoop = new resilient_adapter_wrapper_js_1.ResilientPaymentAdapter(loopAdapter);
    registry.register('seeded', resilientSeeded);
    registry.register('loop', resilientLoop);
    const paymentOptionsService = new payment_options_service_js_1.PaymentOptionsService(railsRepo, registry);
    // Health Check
    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    // Checkout Payment Options
    app.post('/api/v1/checkout/payment-options', async (req, res) => {
        try {
            const { currency = 'KES', country = 'KE', amount = 100 } = req.body || {};
            const options = await paymentOptionsService.getAvailableOptions({
                currency,
                country,
                amount: Number(amount),
            });
            res.status(200).json({ options });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // Stubs for Phase 0/1/3 endpoints returning 501
    const stubRoute = (_req, res) => {
        res.status(501).json({ error: 'Endpoint stubbed - not implemented yet' });
    };
    app.post('/api/v1/checkout/intents', stubRoute);
    app.get('/api/v1/checkout/intents/:id', stubRoute);
    app.post('/api/v1/payouts', stubRoute);
    app.get('/api/v1/reconciliation/matches', stubRoute);
    return { app, railsRepo, registry, paymentOptionsService };
}
