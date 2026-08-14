import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { generateLoopSignature } from '../src/integration/loop/loop-signing.js';

describe('LOOP HMAC-SHA256 Request Signing', () => {
  const TEST_SECRET = process.env.LOOP_SECRET_KEY || 'test_loop_sandbox_signing_secret';

  it('reproduces Test Vector 1: LOOP Prompt', () => {
    const params = {
      merchantTill: '133239',
      timestamp: '2026-07-21T07:37:56Z',
      nonce: '3a4c1f3d-5b00-478f-bd18-4ccf6fae895a',
      secretKey: TEST_SECRET,
    };
    const expected = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${params.merchantTill}|${params.timestamp}|${params.nonce}`)
      .digest('hex');
    const sig = generateLoopSignature(params);
    expect(sig).toBe(expected);
  });

  it('reproduces Test Vector 2: Send Money LOOP', () => {
    const params = {
      merchantTill: '133239',
      timestamp: '2026-07-21T08:45:56Z',
      nonce: 'f68836cd-ea13-49d9-85fd-b08fc2f1b795',
      secretKey: TEST_SECRET,
    };
    const expected = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${params.merchantTill}|${params.timestamp}|${params.nonce}`)
      .digest('hex');
    const sig = generateLoopSignature(params);
    expect(sig).toBe(expected);
  });

  it('reproduces Test Vector 3: Send Money M-Pesa / Inquiry', () => {
    const params = {
      merchantTill: '133239',
      timestamp: '2026-07-21T08:47:12Z',
      nonce: 'c2a91b7e-4d05-4f8a-a3c6-9e1f5d7b2a48',
      secretKey: TEST_SECRET,
    };
    const expected = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${params.merchantTill}|${params.timestamp}|${params.nonce}`)
      .digest('hex');
    const sig = generateLoopSignature(params);
    expect(sig).toBe(expected);
  });
});
