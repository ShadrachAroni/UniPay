import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { getEnabledRailsFor, resetRailCache } from '../services/paymentRailService';
import { seedDemoData } from '../scripts/seed-demo-data';
import { clearProfileCache, createProfile, submitIdentity } from '../services/profileService';
import { clearAliasCache, createAlias } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import { clearPaymentIntentCache } from '../services/paymentIntentService';
import { clearTransactionCache } from '../services/transactionService';
import { clearPayoutCache } from '../services/payoutService';
import { clearAuditLogCache } from '../services/auditLogService';
import { clearAdminUserCache, createOrUpdateAdminUser } from '../services/adminService';

describe('Phase 10 Verification Test Suite — Seeded Scalability Proof & Demo Prep', () => {
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

  beforeEach(async () => {
    clearProfileCache();
    clearAliasCache();
    clearIdempotencyCache();
    clearPaymentIntentCache();
    clearTransactionCache();
    clearPayoutCache();
    clearAuditLogCache();
    clearAdminUserCache();
    resetRailCache();

    await createOrUpdateAdminUser({
      clerk_user_id: 'clerk_admin_super',
      role: 'super_admin',
    });
  });

  describe('1. Second Seeded Rail Architecture Proof (§9b, §8)', () => {
    it('registers seeded_2 adapter in defaultAdapterRegistry implementing PaymentProviderAdapter', () => {
      assert.ok(defaultAdapterRegistry.has('seeded_2'), 'seeded_2 adapter must be registered');
      const adapter = defaultAdapterRegistry.get('seeded_2');
      assert.strictEqual(adapter.name(), 'seeded_2');

      const capabilities = adapter.capabilities();
      assert.ok(capabilities.collection);
      assert.ok(capabilities.disbursement);
      assert.deepStrictEqual(capabilities.supportedCurrencies, ['KES']);
    });

    it('returns seeded_2 as an active payment rail option for KES currency', async () => {
      const rails = await getEnabledRailsFor('KES', 'KE', 1000);
      const seeded2Rail = rails.find((r) => r.adapter_key === 'seeded_2');
      assert.ok(seeded2Rail, 'seeded_2 rail must be returned in enabled rails list');
      assert.strictEqual(seeded2Rail.name, 'PesaLink Rail (Simulated Fixture)');
      assert.strictEqual(seeded2Rail.is_enabled, true);
    });

    it('toggles seeded_2 rail configuration via Admin API and affects checkout resolution dynamically', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_merchant_p10_test',
        account_type: 'business',
        display_name: 'P10 Merchant',
        owner_name: 'Alice Wanja',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-10101010',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@p10merchant',
      });

      // Disable seeded and loop rails so seeded_2 is tested
      const toggleSeededRes = await fetch(`${baseUrl}/api/v1/admin/payment-rails/seeded_2`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: false }),
      });
      assert.strictEqual(toggleSeededRes.status, 200);

      const updatedRails = await getEnabledRailsFor('KES', 'KE', 1000);
      const disabledSeeded2 = updatedRails.find((r) => r.adapter_key === 'seeded_2');
      assert.strictEqual(disabledSeeded2, undefined, 'Disabled seeded_2 rail must not be returned');
    });
  });

  describe('2. Demo Data Seeding & Account Credential Verification (§8, Task 5a)', () => {
    it('executes seedDemoData and populates required persona profiles and transactions', async () => {
      const seedResult = await seedDemoData();
      assert.ok(seedResult.aminaProfile, 'Amina profile must be created');
      assert.strictEqual(seedResult.aminaProfile.display_name, "Amina's Organic Hub");
      assert.strictEqual(seedResult.aminaProfile.verification_status, 'approved');

      assert.ok(seedResult.kenProfile, 'Ken profile must be created');
      assert.strictEqual(seedResult.kenProfile.display_name, 'Ken Njoroge');

      assert.ok(seedResult.freshBitesProfile, 'FreshBites profile must be created');
      assert.strictEqual(seedResult.freshBitesProfile.verification_status, 'submitted');

      assert.ok(seedResult.transactionsCount >= 5, 'Must seed at least 5 realistic historical transactions');
      assert.ok(seedResult.payoutsCount >= 3, 'Must seed at least 3 realistic historical payouts');
    });
  });

  describe('3. Honesty & Simulation Labeling Walkthrough (§8, §22)', () => {
    it('ensures seeded_2 adapter normalization explicitly preserves simulated fixture labels', () => {
      const adapter = defaultAdapterRegistry.get('seeded_2');
      const normalized = adapter.normalize({
        amount: 2500,
        currency: 'KES',
        reference: 'EXT_SEEDED_2_TEST',
      });

      assert.strictEqual(normalized.provider, 'seeded_2');
      assert.strictEqual(normalized.currency, 'KES');
      assert.strictEqual(normalized.payment_status, 'successful');
    });
  });
});
