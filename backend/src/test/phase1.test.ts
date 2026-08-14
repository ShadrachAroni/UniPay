import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache } from '../services/profileService';
import { clearAliasCache } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';

describe('Phase 1 Verification Test Suite — Identity, Auth & Data Model', () => {
  let server: any;
  let baseUrl: string;

  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    clearProfileCache();
    clearAliasCache();
    clearIdempotencyCache();
  });

  describe('Single Account Model & Profile Creation (§7, §9b, §11)', () => {
    it('creates an individual profile successfully', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_amina_123',
        },
        body: JSON.stringify({
          account_type: 'individual',
          display_name: 'Amina Mwangi',
          owner_name: 'Amina Jane Mwangi',
          phone: '+254712345678',
          email: 'amina@example.com',
        }),
      });

      assert.strictEqual(res.status, 201);
      const data: any = await res.json();
      assert.ok(data.profile.id);
      assert.strictEqual(data.profile.account_type, 'individual');
      assert.strictEqual(data.profile.display_name, 'Amina Mwangi');
      assert.strictEqual(data.profile.owner_name, 'Amina Jane Mwangi');
      assert.strictEqual(data.profile.currency, 'KES');
      assert.strictEqual(data.profile.country_code, 'KE');
      assert.strictEqual(data.profile.status, 'active');
      assert.strictEqual(data.profile.verification_status, 'unsubmitted');
    });

    it('creates a business profile using the exact same table & endpoint (flag, not a fork)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_biz_456',
        },
        body: JSON.stringify({
          account_type: 'business',
          display_name: 'Nairobi Fresh Grocers',
          owner_name: 'David Otieno',
          phone: '+254722998877',
          email: 'sales@nairobigrocers.co.ke',
        }),
      });

      assert.strictEqual(res.status, 201);
      const data: any = await res.json();
      assert.ok(data.profile.id);
      assert.strictEqual(data.profile.account_type, 'business');
      assert.strictEqual(data.profile.display_name, 'Nairobi Fresh Grocers');
      assert.strictEqual(data.profile.verification_status, 'unsubmitted');
    });
  });

  describe('JWT Authentication & Route Protection (§19)', () => {
    it('rejects unauthenticated requests on non-checkout routes with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: 'individual',
          display_name: 'Unauthenticated User',
          owner_name: 'No Auth',
        }),
      });

      assert.strictEqual(res.status, 401);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'Unauthorized');
    });

    it('allows unauthenticated requests to public checkout routes by design', async () => {
      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@nonexistent_alias_public_checkout_test',
          amount: 500,
          currency: 'KES',
        }),
      });

      // Checkout is public and not blocked with 401 Unauthorized (returns 404 when alias not yet created)
      assert.notStrictEqual(res.status, 401);
      assert.strictEqual(res.status, 404);
    });
  });

  describe('Identity Submission Gating on Alias Creation (§8, §11)', () => {
    let profileId: string;

    beforeEach(async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_gating_test',
        },
        body: JSON.stringify({
          account_type: 'individual',
          display_name: 'Gating Profile',
          owner_name: 'John Doe',
        }),
      });
      const data: any = await res.json();
      profileId = data.profile.id;
    });

    it('strictly rejects alias creation when profile verification_status is unsubmitted (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles/${profileId}/aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_gating_test',
        },
        body: JSON.stringify({
          alias: 'johndoe',
        }),
      });

      assert.strictEqual(res.status, 403);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'Forbidden');
      assert.ok(body.message.includes('Identity verification required'));
    });

    it('submits KYC ID documents & face selfie photo and transitions verification_status to submitted', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles/${profileId}/identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_gating_test',
        },
        body: JSON.stringify({
          id_number: '29883741',
          id_document_url: 'https://storage.unipay.ke/documents/national_id_front.jpg',
          id_selfie_url: 'https://storage.unipay.ke/selfies/face_selfie_live.jpg',
        }),
      });

      assert.strictEqual(res.status, 200);
      const body: any = await res.json();
      assert.strictEqual(body.profile.verification_status, 'submitted');
      assert.strictEqual(body.profile.id_number, '29883741');
      assert.ok(body.profile.id_submitted_at);
      assert.ok(body.message.includes('under review'));
    });

    it('generates alias and QR code successfully once identity is submitted', async () => {
      // 1. Submit identity
      await fetch(`${baseUrl}/api/v1/profiles/${profileId}/identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_gating_test',
        },
        body: JSON.stringify({
          id_number: '29883741',
          id_document_url: 'https://storage.unipay.ke/documents/national_id_front.jpg',
          id_selfie_url: 'https://storage.unipay.ke/selfies/face_selfie_live.jpg',
        }),
      });

      // 2. Generate alias
      const res = await fetch(`${baseUrl}/api/v1/profiles/${profileId}/aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_gating_test',
        },
        body: JSON.stringify({
          alias: 'johndoe',
        }),
      });

      assert.strictEqual(res.status, 201);
      const body: any = await res.json();
      assert.strictEqual(body.alias.alias, '@johndoe');
      assert.strictEqual(body.alias.identifier_type, 'alias');
      assert.strictEqual(body.alias.status, 'active');
    });
  });

  describe('Public Unauthenticated Alias Lookup (§18, §19)', () => {
    it('allows public payers to look up recipient details by alias handle', async () => {
      // 1. Create profile & submit ID
      const profRes = await fetch(`${baseUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_lookup_test',
        },
        body: JSON.stringify({
          account_type: 'business',
          display_name: 'Mama Mboga Fresh',
          owner_name: 'Grace Wambui',
        }),
      });
      const profData: any = await profRes.json();
      const profId = profData.profile.id;

      await fetch(`${baseUrl}/api/v1/profiles/${profId}/identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_lookup_test',
        },
        body: JSON.stringify({
          id_number: '12345678',
          id_document_url: 'https://storage.unipay.ke/documents/id.jpg',
          id_selfie_url: 'https://storage.unipay.ke/selfies/face.jpg',
        }),
      });

      await fetch(`${baseUrl}/api/v1/profiles/${profId}/aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_lookup_test',
        },
        body: JSON.stringify({
          alias: 'mamamboga',
        }),
      });

      // 2. Query publicly without auth
      const res = await fetch(`${baseUrl}/api/v1/aliases/@mamamboga`);
      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.alias.alias, '@mamamboga');
      assert.strictEqual(data.recipient.display_name, 'Mama Mboga Fresh');
      assert.strictEqual(data.recipient.account_type, 'business');
      assert.strictEqual(data.recipient.currency, 'KES');
    });
  });

  describe('Manual / Admin Verification Review Toggle (§19)', () => {
    it('transitions profile from submitted to approved with review metadata', async () => {
      const profRes = await fetch(`${baseUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_review_test',
        },
        body: JSON.stringify({
          account_type: 'individual',
          display_name: 'Review Candidate',
          owner_name: 'Alice Wanjiku',
        }),
      });
      const profData: any = await profRes.json();
      const profId = profData.profile.id;

      await fetch(`${baseUrl}/api/v1/profiles/${profId}/identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_user_review_test',
        },
        body: JSON.stringify({
          id_number: '87654321',
          id_document_url: 'https://storage.unipay.ke/documents/alice_id.jpg',
          id_selfie_url: 'https://storage.unipay.ke/selfies/alice_face.jpg',
        }),
      });

      const reviewRes = await fetch(`${baseUrl}/api/v1/profiles/${profId}/identity/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_admin_user',
        },
        body: JSON.stringify({
          decision: 'approved',
          reviewer_note: 'Verified national ID matches face selfie',
        }),
      });

      assert.strictEqual(reviewRes.status, 200);
      const reviewData: any = await reviewRes.json();
      assert.strictEqual(reviewData.profile.verification_status, 'approved');
      assert.ok(reviewData.profile.id_reviewed_at);
      assert.strictEqual(reviewData.profile.id_reviewer_note, 'Verified national ID matches face selfie');
    });
  });

  describe('Idempotency Key Enforcement (Handbook M8.3)', () => {
    it('accepts and honors x-idempotency-key on write endpoints by returning cached response', async () => {
      const idempotencyKey = 'idemp_key_phase1_' + Date.now();
      const testUserId = 'test_user_idemp_' + Date.now();

      const payload = {
        account_type: 'individual',
        display_name: 'Idempotency Test User',
        owner_name: 'Idemp Tester',
      };

      // 1. Initial request
      const res1 = await fetch(`${baseUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserId}`,
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res1.status, 201);
      const data1: any = await res1.json();
      assert.ok(data1.profile.id);

      // 2. Retried request with identical key & body
      const res2 = await fetch(`${baseUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserId}`,
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res2.status, 201);
      assert.strictEqual(res2.headers.get('x-idempotent-replayed'), 'true');
      const data2: any = await res2.json();
      assert.strictEqual(data2.profile.id, data1.profile.id);
    });
  });
});
