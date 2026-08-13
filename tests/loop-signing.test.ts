import { describe, it, expect } from 'vitest';
import { generateLoopSignature } from '../src/integration/loop/loop-signing.js';

describe('LOOP HMAC-SHA256 Request Signing', () => {
  const SANDBOX_SECRET = 'hyqd7bwMr9Kv-C5PW4n7uF4TiMnMp_hyvyhYYkYlcU8';

  it('reproduces Test Vector 1: LOOP Prompt', () => {
    const sig = generateLoopSignature({
      merchantTill: '133239',
      timestamp: '2026-07-21T07:37:56Z',
      nonce: '3a4c1f3d-5b00-478f-bd18-4ccf6fae895a',
      secretKey: SANDBOX_SECRET,
    });
    expect(sig).toBe('557dc74f9e53ec51b1c48aeaebe60bc89e108b753d7874336286c333a3692c5c');
  });

  it('reproduces Test Vector 2: Send Money LOOP', () => {
    const sig = generateLoopSignature({
      merchantTill: '133239',
      timestamp: '2026-07-21T08:45:56Z',
      nonce: 'f68836cd-ea13-49d9-85fd-b08fc2f1b795',
      secretKey: SANDBOX_SECRET,
    });
    expect(sig).toBe('1868bb7e1b601ce255c732da494dff0797d36451e59e5d3c4bf79bd8ee70d86a');
  });

  it('reproduces Test Vector 3: Send Money M-Pesa / Inquiry', () => {
    const sig = generateLoopSignature({
      merchantTill: '133239',
      timestamp: '2026-07-21T08:47:12Z',
      nonce: 'c2a91b7e-4d05-4f8a-a3c6-9e1f5d7b2a48',
      secretKey: SANDBOX_SECRET,
    });
    expect(sig).toBe('8b48798149f4f71095dabbeea88c116730fb56f18c90970b39d992442f9561c9');
  });
});
