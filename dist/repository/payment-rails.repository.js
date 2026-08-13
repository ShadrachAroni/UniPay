"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLoopRail = exports.defaultSeededRail = exports.defaultLoopCapabilities = exports.defaultSeededCapabilities = exports.PaymentRailsRepository = void 0;
class PaymentRailsRepository {
    rails = new Map();
    constructor(initialRails = []) {
        for (const rail of initialRails) {
            this.rails.set(rail.adapter_key, { ...rail });
        }
    }
    async findAll() {
        return Array.from(this.rails.values());
    }
    async findAllEnabled() {
        return Array.from(this.rails.values()).filter((r) => r.is_enabled);
    }
    async findByAdapterKey(adapterKey) {
        const rail = this.rails.get(adapterKey);
        return rail ? { ...rail } : null;
    }
    async filterAvailable(criteria) {
        const enabledRails = await this.findAllEnabled();
        return enabledRails.filter((rail) => {
            const currencySupported = rail.supported_currencies.includes(criteria.currency);
            const countrySupported = rail.supported_countries.includes(criteria.country);
            const amountWithinBounds = criteria.amount >= rail.min_amount && criteria.amount <= rail.max_amount;
            return currencySupported && countrySupported && amountWithinBounds;
        });
    }
    async setRailEnabled(adapterKey, isEnabled) {
        const rail = this.rails.get(adapterKey);
        if (!rail)
            return null;
        rail.is_enabled = isEnabled;
        this.rails.set(adapterKey, rail);
        return { ...rail };
    }
    async save(rail) {
        this.rails.set(rail.adapter_key, { ...rail });
        return { ...rail };
    }
}
exports.PaymentRailsRepository = PaymentRailsRepository;
exports.defaultSeededCapabilities = {
    collection: true,
    statusInquiry: true,
    refund: true,
    disbursement: true,
    webhooks: true,
    supportedCurrencies: ['KES'],
    supportedCountries: ['KE'],
};
exports.defaultLoopCapabilities = {
    collection: true,
    statusInquiry: true,
    refund: true,
    disbursement: true,
    webhooks: true,
    supportedCurrencies: ['KES'],
    supportedCountries: ['KE'],
};
exports.defaultSeededRail = {
    id: 'rail_seeded_001',
    name: 'Seeded Payment Rail',
    adapter_key: 'seeded',
    is_enabled: true,
    supported_currencies: ['KES'],
    supported_countries: ['KE'],
    min_amount: 1,
    max_amount: 500000,
    capabilities_json: exports.defaultSeededCapabilities,
};
exports.defaultLoopRail = {
    id: 'rail_loop_001',
    name: 'LOOP Mobile Money',
    adapter_key: 'loop',
    is_enabled: true,
    supported_currencies: ['KES'],
    supported_countries: ['KE'],
    min_amount: 1,
    max_amount: 250000,
    capabilities_json: exports.defaultLoopCapabilities,
};
