"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeededPaymentAdapter = void 0;
class SeededPaymentAdapter {
    paymentStore = new Map();
    refundStore = new Map();
    payoutStore = new Map();
    name() {
        return 'seeded';
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
    async createPayment(request) {
        // Deterministic status based on orderReference prefix
        let status = 'completed';
        let rawStatus = 'SUCCESS';
        if (request.orderReference.startsWith('FAIL_')) {
            status = 'failed';
            rawStatus = 'FAILED';
        }
        else if (request.orderReference.startsWith('PEND_')) {
            status = 'pending';
            rawStatus = 'PENDING';
        }
        const providerReference = `SEEDED_PAY_${request.idempotencyKey}`;
        const rawPayload = {
            seeded_tx_id: providerReference,
            order_ref: request.orderReference,
            amount_kes: request.amount,
            fee_kes: Math.round(request.amount * 0.01 * 100) / 100, // 1% fee
            status: rawStatus,
            payer_mobile: request.payerPhone ?? '+254700000000',
            created_at: new Date().toISOString(),
            settled_at: rawStatus === 'SUCCESS' ? new Date().toISOString() : undefined,
        };
        this.paymentStore.set(providerReference, rawPayload);
        return {
            providerReference,
            status,
            rawResponse: rawPayload,
        };
    }
    async getStatus(providerReference) {
        const record = this.paymentStore.get(providerReference);
        if (!record) {
            return {
                providerReference,
                status: 'failed',
                rawResponse: { error: 'Transaction not found in Seeded store' },
            };
        }
        let status = 'completed';
        if (record.status === 'PENDING')
            status = 'pending';
        else if (record.status === 'FAILED')
            status = 'failed';
        else if (record.status === 'REVERSED')
            status = 'failed';
        return {
            providerReference: record.seeded_tx_id,
            status,
            amount: record.amount_kes,
            currency: 'KES',
            rawResponse: record,
        };
    }
    async refund(request) {
        const record = this.paymentStore.get(request.providerReference);
        const refundReference = `SEEDED_REF_${request.idempotencyKey}`;
        if (!record || record.status !== 'SUCCESS') {
            return {
                refundReference,
                status: 'failed',
                rawResponse: { error: 'Original transaction not eligible for refund' },
            };
        }
        const resultStatus = request.reason?.includes('FAIL') ? 'failed' : 'completed';
        this.refundStore.set(refundReference, {
            refund_id: refundReference,
            amount: request.amount,
            status: resultStatus,
        });
        return {
            refundReference,
            status: resultStatus,
            rawResponse: {
                refund_id: refundReference,
                original_tx: request.providerReference,
                amount: request.amount,
                currency: request.currency,
                status: resultStatus.toUpperCase(),
            },
        };
    }
    async disburse(request) {
        const disbursementReference = `SEEDED_DISB_${request.idempotencyKey}`;
        const resultStatus = request.recipientIdentifier.includes('INVALID') ? 'failed' : 'completed';
        this.payoutStore.set(disbursementReference, {
            payout_id: disbursementReference,
            amount: request.amount,
            status: resultStatus,
        });
        return {
            disbursementReference,
            status: resultStatus === 'completed' ? 'completed' : 'failed',
            rawResponse: {
                disbursement_id: disbursementReference,
                recipient: request.recipientIdentifier,
                amount: request.amount,
                currency: request.currency,
                status: resultStatus.toUpperCase(),
            },
        };
    }
    normalize(payload) {
        const data = payload;
        if (!data || typeof data !== 'object' || !('seeded_tx_id' in data)) {
            throw new Error('Invalid raw payload for Seeded payment normalization');
        }
        let paymentStatus = 'successful';
        let settlementStatus = 'settled';
        if (data.status === 'PENDING') {
            paymentStatus = 'initiated';
            settlementStatus = 'pending';
        }
        else if (data.status === 'FAILED') {
            paymentStatus = 'failed';
            settlementStatus = 'pending';
        }
        else if (data.status === 'REVERSED') {
            paymentStatus = 'reversed';
            settlementStatus = 'pending';
        }
        const providerFee = data.fee_kes ?? 0;
        const netAmount = data.amount_kes - providerFee;
        return {
            internalReference: `INT_${data.seeded_tx_id}`,
            externalReference: data.seeded_tx_id,
            provider: 'seeded',
            rail: 'seeded',
            amount: data.amount_kes,
            currency: 'KES',
            providerFee,
            netAmount,
            payerIdentifier: data.payer_mobile,
            paymentStatus,
            settlementStatus,
            refundStatus: 'none',
            transactionTime: new Date(data.created_at || Date.now()),
            rawPayload: payload,
        };
    }
    verifyWebhook(req) {
        const signatureHeader = req.headers['x-seeded-signature'];
        if (Array.isArray(signatureHeader)) {
            return signatureHeader.includes('valid-seeded-signature');
        }
        return signatureHeader === 'valid-seeded-signature';
    }
}
exports.SeededPaymentAdapter = SeededPaymentAdapter;
