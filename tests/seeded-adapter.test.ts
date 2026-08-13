import { describe, it, expect, beforeEach } from 'vitest';
import { SeededPaymentAdapter } from '../src/adapters/seeded.adapter.js';

describe('SeededPaymentAdapter', () => {
  let adapter: SeededPaymentAdapter;

  beforeEach(() => {
    adapter = new SeededPaymentAdapter();
  });

  it('has correct name and capabilities', () => {
    expect(adapter.name()).toBe('seeded');
    const caps = adapter.capabilities();
    expect(caps.collection).toBe(true);
    expect(caps.statusInquiry).toBe(true);
    expect(caps.refund).toBe(true);
    expect(caps.disbursement).toBe(true);
    expect(caps.webhooks).toBe(true);
    expect(caps.supportedCurrencies).toContain('KES');
    expect(caps.supportedCountries).toContain('KE');
  });

  it('completes createPayment -> getStatus -> normalize cycle for successful payment', async () => {
    const paymentRequest = {
      amount: 1500,
      currency: 'KES',
      payerPhone: '+254712345678',
      orderReference: 'ORD_12345',
      idempotencyKey: 'idem_key_001',
    };

    // 1. createPayment
    const createResult = await adapter.createPayment(paymentRequest);
    expect(createResult.providerReference).toBe('SEEDED_PAY_idem_key_001');
    expect(createResult.status).toBe('completed');
    expect(createResult.rawResponse).toBeDefined();

    // 2. getStatus
    const statusResult = await adapter.getStatus(createResult.providerReference);
    expect(statusResult.providerReference).toBe('SEEDED_PAY_idem_key_001');
    expect(statusResult.status).toBe('completed');
    expect(statusResult.amount).toBe(1500);

    // 3. normalize
    const normalized = adapter.normalize(statusResult.rawResponse);
    expect(normalized.internalReference).toBe('INT_SEEDED_PAY_idem_key_001');
    expect(normalized.externalReference).toBe('SEEDED_PAY_idem_key_001');
    expect(normalized.provider).toBe('seeded');
    expect(normalized.rail).toBe('seeded');
    expect(normalized.amount).toBe(1500);
    expect(normalized.currency).toBe('KES');
    expect(normalized.providerFee).toBe(15); // 1% of 1500
    expect(normalized.netAmount).toBe(1485);
    expect(normalized.paymentStatus).toBe('successful');
    expect(normalized.settlementStatus).toBe('settled');
  });

  it('supports pending payment lifecycle', async () => {
    const paymentRequest = {
      amount: 2000,
      currency: 'KES',
      orderReference: 'PEND_ORD_999',
      idempotencyKey: 'idem_pend_001',
    };

    const createResult = await adapter.createPayment(paymentRequest);
    expect(createResult.status).toBe('pending');

    const statusResult = await adapter.getStatus(createResult.providerReference);
    expect(statusResult.status).toBe('pending');

    const normalized = adapter.normalize(statusResult.rawResponse);
    expect(normalized.paymentStatus).toBe('initiated');
    expect(normalized.settlementStatus).toBe('pending');
  });

  it('supports failed payment lifecycle', async () => {
    const paymentRequest = {
      amount: 500,
      currency: 'KES',
      orderReference: 'FAIL_ORD_000',
      idempotencyKey: 'idem_fail_001',
    };

    const createResult = await adapter.createPayment(paymentRequest);
    expect(createResult.status).toBe('failed');

    const statusResult = await adapter.getStatus(createResult.providerReference);
    expect(statusResult.status).toBe('failed');

    const normalized = adapter.normalize(statusResult.rawResponse);
    expect(normalized.paymentStatus).toBe('failed');
  });

  it('handles refund capability deterministically', async () => {
    // First create a successful payment
    const createResult = await adapter.createPayment({
      amount: 1000,
      currency: 'KES',
      orderReference: 'ORD_REFUND_TEST',
      idempotencyKey: 'idem_ref_orig',
    });

    const refundResult = await adapter.refund({
      providerReference: createResult.providerReference,
      amount: 1000,
      currency: 'KES',
      idempotencyKey: 'idem_ref_req',
    });

    expect(refundResult.refundReference).toBe('SEEDED_REF_idem_ref_req');
    expect(refundResult.status).toBe('completed');
  });

  it('handles disburse capability deterministically', async () => {
    const payoutResult = await adapter.disburse({
      recipientIdentifier: '+254722000111',
      amount: 3000,
      currency: 'KES',
      idempotencyKey: 'idem_payout_001',
    });

    expect(payoutResult.disbursementReference).toBe('SEEDED_DISB_idem_payout_001');
    expect(payoutResult.status).toBe('completed');
  });

  it('verifies webhooks correctly', () => {
    const validReq = {
      headers: { 'x-seeded-signature': 'valid-seeded-signature' },
      body: {},
    };
    const invalidReq = {
      headers: { 'x-seeded-signature': 'invalid-signature' },
      body: {},
    };

    expect(adapter.verifyWebhook(validReq)).toBe(true);
    expect(adapter.verifyWebhook(invalidReq)).toBe(false);
  });
});
