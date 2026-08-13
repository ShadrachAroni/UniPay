"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoopAdapter = void 0;
const payment_errors_js_1 = require("../errors/payment.errors.js");
class LoopAdapter {
    name() {
        return 'loop';
    }
    capabilities() {
        return {
            collection: true,
            statusInquiry: true,
            refund: true,
            disbursement: true,
            webhooks: true,
            supportedCurrencies: ['KES'],
            supportedCountries: ['KE'],
        };
    }
    async createPayment(_request) {
        throw new payment_errors_js_1.UnimplementedPhase3Error('LoopAdapter.createPayment');
    }
    async getStatus(_providerReference) {
        throw new payment_errors_js_1.UnimplementedPhase3Error('LoopAdapter.getStatus');
    }
    async refund(_request) {
        throw new payment_errors_js_1.UnimplementedPhase3Error('LoopAdapter.refund');
    }
    async disburse(_request) {
        throw new payment_errors_js_1.UnimplementedPhase3Error('LoopAdapter.disburse');
    }
    normalize(_payload) {
        throw new payment_errors_js_1.UnimplementedPhase3Error('LoopAdapter.normalize');
    }
    verifyWebhook(_req) {
        throw new payment_errors_js_1.UnimplementedPhase3Error('LoopAdapter.verifyWebhook');
    }
}
exports.LoopAdapter = LoopAdapter;
