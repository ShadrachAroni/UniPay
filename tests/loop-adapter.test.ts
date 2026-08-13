import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoopAdapter } from '../src/adapters/loop.adapter.js';
import { LoopApiClient } from '../src/integration/loop/loop-api.client.js';
import { LoopAuthClient } from '../src/integration/loop/loop-auth.client.js';

describe('LoopAdapter Unit Tests', () => {
  let adapter: LoopAdapter;
  let mockApiClient: LoopApiClient;

  beforeEach(() => {
    const authClient = new LoopAuthClient({
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
    });

    mockApiClient = new LoopApiClient({
      merchantTill: '133239',
      secretKey: 'hyqd7bwMr9Kv-C5PW4n7uF4TiMnMp_hyvyhYYkYlcU8',
      authClient,
    });

    adapter = new LoopAdapter({ apiClient: mockApiClient });
  });

  it('has correct name and capabilities', () => {
    expect(adapter.name()).toBe('loop');
    const caps = adapter.capabilities();
    expect(caps.collection).toBe(true);
    expect(caps.statusInquiry).toBe(true);
    expect(caps.refund).toBe(false); // LOOP does not document automated refund
    expect(caps.disbursement).toBe(true);
    expect(caps.webhooks).toBe(true);
    expect(caps.supportedCurrencies).toEqual(['KES']);
    expect(caps.supportedCountries).toEqual(['KE']);
  });

  it('initiates createPayment using LOOP Prompt', async () => {
    vi.spyOn(mockApiClient, 'requestToPay').mockResolvedValue({
      statusCode: 200,
      message: 'service process accepted',
      data: {
        serviceTransactionStatus: 'COMPLETED',
        txnReference: 'IDEM_KEY_123',
        response: {
          transactionRef: 'TXN-20260721-000001042',
          rspMessage: 'SUCCESS',
        },
      },
    });

    const result = await adapter.createPayment({
      amount: 100,
      currency: 'KES',
      payerPhone: '254704540384',
      orderReference: 'ORD_PROMPT_001',
      idempotencyKey: 'IDEM_KEY_123',
    });

    expect(result.providerReference).toBe('IDEM_KEY_123');
    expect(result.status).toBe('pending');
    expect(mockApiClient.requestToPay).toHaveBeenCalledWith({
      amount: 100,
      payerPhone: '254704540384',
      orderReference: 'ORD_PROMPT_001',
      idempotencyKey: 'IDEM_KEY_123',
    });
  });

  it('inquires status using Transaction Inquiry endpoint', async () => {
    vi.spyOn(mockApiClient, 'transactionInquiry').mockResolvedValue({
      statusCode: 200,
      message: 'service process accepted',
      data: {
        serviceTransactionStatus: 'COMPLETED',
        response: {
          status: 'COMPLETED',
          finalState: true,
          amount: '100',
          currency: 'KES',
          transactionRef: 'TXN-20260721-000001042',
        },
      },
    });

    const statusResult = await adapter.getStatus('IDEM_KEY_123');

    expect(statusResult.providerReference).toBe('IDEM_KEY_123');
    expect(statusResult.status).toBe('completed');
    expect(statusResult.amount).toBe(100);
  });

  it('normalizes raw LOOP response into NormalizedTransaction with settlement pending', () => {
    const rawPayload = {
      statusCode: 200,
      message: 'service process accepted',
      data: {
        serviceTransactionStatus: 'COMPLETED',
        response: {
          status: 'COMPLETED',
          finalState: true,
          amount: '150.00',
          currency: 'KES',
          fee: '1.50',
          transactionRef: 'TXN-20260721-000001042',
          payerMobile: '254704540384',
        },
      },
    };

    const normalized = adapter.normalize(rawPayload);

    expect(normalized.provider).toBe('loop');
    expect(normalized.rail).toBe('loop');
    expect(normalized.amount).toBe(150);
    expect(normalized.providerFee).toBe(1.5);
    expect(normalized.netAmount).toBe(148.5);
    expect(normalized.externalReference).toBe('TXN-20260721-000001042');
    expect(normalized.paymentStatus).toBe('successful');
    // Critical assertion: payment success MUST leave settlementStatus = 'pending'
    expect(normalized.settlementStatus).toBe('pending');
  });
});
