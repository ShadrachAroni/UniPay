import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache, createProfile, submitIdentity } from '../services/profileService';
import { clearAliasCache, createAlias } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import { clearPaymentIntentCache } from '../services/paymentIntentService';
import { clearTransactionCache, recordTransaction } from '../services/transactionService';
import { resetRailCache } from '../services/paymentRailService';
import { clearAuditLogCache, queryAuditLogs } from '../services/auditLogService';
import { clearAdminUserCache, createOrUpdateAdminUser } from '../services/adminService';
import { createPayout, clearPayoutCache } from '../services/payoutService';
import { createDispute } from '../services/adminService';

describe('Phase 8 Verification Test Suite — Admin Module, Role-Gating & Audit Logging', () => {
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

    // Register admin test users for role tests
    await createOrUpdateAdminUser({
      clerk_user_id: 'clerk_admin_super',
      role: 'super_admin',
    });
    await createOrUpdateAdminUser({
      clerk_user_id: 'clerk_admin_support',
      role: 'support',
    });
    await createOrUpdateAdminUser({
      clerk_user_id: 'clerk_admin_compliance',
      role: 'compliance_reviewer',
    });
  });

  describe('1. Server-Side Role Enforcement (§16, §19)', () => {
    it('rejects unauthenticated requests to admin routes with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/users`);
      assert.strictEqual(res.status, 401);
      const data: any = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    it('rejects non-admin user tokens with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/users`, {
        headers: { Authorization: 'Bearer user_regular_customer' },
      });
      assert.strictEqual(res.status, 403);
      const data: any = await res.json();
      assert.strictEqual(data.error, 'Forbidden');
    });

    it('rejects support role on super_admin-only rail configuration with 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/payment-rails/loop`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_support',
        },
        body: JSON.stringify({ is_enabled: false }),
      });
      assert.strictEqual(res.status, 403);
      const data: any = await res.json();
      assert.strictEqual(data.error, 'Forbidden');
      assert.strictEqual(data.current_role, 'support');
    });

    it('rejects support role on compliance-only identity review with 403', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_user_kyc_test',
        account_type: 'individual',
        display_name: 'Test KYC User',
        owner_name: 'Jane Doe',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-12345678',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });

      const res = await fetch(`${baseUrl}/api/v1/admin/users/${profile.id}/identity/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_support',
        },
        body: JSON.stringify({ decision: 'approved' }),
      });

      assert.strictEqual(res.status, 403);
      const data: any = await res.json();
      assert.strictEqual(data.error, 'Forbidden');
    });

    it('allows super_admin role to update payment rail config with 200', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/payment-rails/loop`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: false }),
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.rail.is_enabled, false);
    });
  });

  describe('2. Rail Toggle Round-Trip & Operational Checkout Impact (§9b, §16)', () => {
    it('disabling rails via Admin immediately alters checkout payment options resolution dynamically', async () => {
      // 1. Setup profile and alias for checkout
      const profile = await createProfile({
        clerk_user_id: 'clerk_merchant_toggle_test',
        account_type: 'business',
        display_name: 'Nairobi Market',
        owner_name: 'David Kim',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-99887766',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@nairobimarket',
      });

      // 2. Initial checkout options -> seeded is primary
      let checkoutRes = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@nairobimarket',
          amount: 2500,
          currency: 'KES',
        }),
      });
      assert.strictEqual(checkoutRes.status, 200);
      let checkoutData: any = await checkoutRes.json();
      assert.strictEqual(checkoutData.provider, 'seeded');

      // 3. Disable seeded and seeded_2 rails via Admin API -> LOOP becomes primary
      const toggleSeededRes = await fetch(`${baseUrl}/api/v1/admin/payment-rails/seeded`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: false }),
      });
      assert.strictEqual(toggleSeededRes.status, 200);

      await fetch(`${baseUrl}/api/v1/admin/payment-rails/seeded_2`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: false }),
      });

      checkoutRes = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@nairobimarket',
          amount: 2500,
          currency: 'KES',
        }),
      });
      assert.strictEqual(checkoutRes.status, 200);
      checkoutData = await checkoutRes.json();
      assert.strictEqual(checkoutData.provider, 'loop');

      // 4. Disable LOOP and seeded_2 rails as well -> No enabled rails left (422)
      await fetch(`${baseUrl}/api/v1/admin/payment-rails/seeded_2`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: false }),
      });

      const toggleLoopRes = await fetch(`${baseUrl}/api/v1/admin/payment-rails/loop`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: false }),
      });
      assert.strictEqual(toggleLoopRes.status, 200);

      checkoutRes = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@nairobimarket',
          amount: 2500,
          currency: 'KES',
        }),
      });
      assert.strictEqual(checkoutRes.status, 422);

      // 5. Re-enable LOOP rail via Admin API -> Restored to 200 with loop
      await fetch(`${baseUrl}/api/v1/admin/payment-rails/loop`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: true }),
      });

      checkoutRes = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@nairobimarket',
          amount: 2500,
          currency: 'KES',
        }),
      });
      assert.strictEqual(checkoutRes.status, 200);
      checkoutData = await checkoutRes.json();
      assert.strictEqual(checkoutData.provider, 'loop');

      // 6. Re-enable seeded and seeded_2 rails -> Restored to 200 with seeded
      await fetch(`${baseUrl}/api/v1/admin/payment-rails/seeded`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: true }),
      });
      await fetch(`${baseUrl}/api/v1/admin/payment-rails/seeded_2`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({ is_enabled: true }),
      });

      checkoutRes = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@nairobimarket',
          amount: 2500,
          currency: 'KES',
        }),
      });
      assert.strictEqual(checkoutRes.status, 200);
      checkoutData = await checkoutRes.json();
      assert.strictEqual(checkoutData.provider, 'seeded');
    });
  });

  describe('3. Audit Logging Guarantee on State-Changing Actions (§16, §19)', () => {
    it('identity review writes structured audit log with before/after state', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_audit_kyc_user',
        account_type: 'individual',
        display_name: 'Audit Subject',
        owner_name: 'Grace Hopper',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-77665544',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });

      const res = await fetch(`${baseUrl}/api/v1/admin/users/${profile.id}/identity/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_compliance',
        },
        body: JSON.stringify({
          decision: 'approved',
          reviewer_note: 'Verified national ID credentials',
        }),
      });
      assert.strictEqual(res.status, 200);

      // Verify audit log record
      const auditResult = await queryAuditLogs({ action: 'identity.approved' });
      assert.ok(auditResult.audit_logs.length > 0, 'Audit log must record identity.approved');
      const log = auditResult.audit_logs[0];
      assert.strictEqual(log.target_type, 'profile');
      assert.strictEqual(log.target_id, profile.id);
      assert.strictEqual(log.after_state?.verification_status, 'approved');
      assert.strictEqual(log.after_state?.id_reviewer_note, 'Verified national ID credentials');
    });

    it('rail configuration update writes structured audit log', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/payment-rails/seeded`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({
          fee_percentage: 0.008,
          min_amount: 50,
        }),
      });
      assert.strictEqual(res.status, 200);

      const auditResult = await queryAuditLogs({ action: 'payment_rail.update_config' });
      assert.ok(auditResult.audit_logs.length > 0, 'Audit log must record payment_rail.update_config');
      const log = auditResult.audit_logs[0];
      assert.strictEqual(log.target_id, 'seeded');
      assert.strictEqual(log.after_state?.min_amount, 50);
      assert.strictEqual((log.after_state?.feeStructure as any)?.percentage, 0.008);
    });

    it('exception resolution writes structured audit log', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/exceptions/ex-test-101/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_support',
        },
        body: JSON.stringify({
          action: 'resolve',
          notes: 'Customer refunded via offline bank wire',
        }),
      });
      assert.strictEqual(res.status, 200);

      const auditResult = await queryAuditLogs({ action: 'exception.resolve' });
      assert.ok(auditResult.audit_logs.length > 0, 'Audit log must record exception.resolve');
      const log = auditResult.audit_logs[0];
      assert.strictEqual(log.target_type, 'reconciliation_exception');
      assert.strictEqual(log.target_id, 'ex-test-101');
      assert.strictEqual(log.after_state?.notes, 'Customer refunded via offline bank wire');
    });

    it('payout intervention writes structured audit log', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_payout_audit_user',
        account_type: 'business',
        display_name: 'Payout Audit Merchant',
        owner_name: 'Peter Parker',
      });

      // Fund profile with settled balance
      await recordTransaction(
        {
          provider: 'loop',
          rail: 'loop',
          internal_reference: 'int-payout-fund-101',
          external_reference: 'ext-payout-fund-101',
          amount: 10000,
          currency: 'KES',
          provider_fee: 100,
          net_amount: 9900,
          payer_identifier: '254711111111',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        profile.id
      );

      const payout = await createPayout({
        profile_id: profile.id,
        amount: 3000,
        currency: 'KES',
        destination_type: 'bank_account',
        destination_reference: 'NCBA-***1234',
        idempotency_key: 'idemp-payout-audit-1',
      });

      const res = await fetch(`${baseUrl}/api/v1/admin/payouts/${payout.id}/intervene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_super',
        },
        body: JSON.stringify({
          action: 'retry',
          reason: 'Network cleared, re-submitting to provider gateway',
        }),
      });
      assert.strictEqual(res.status, 200);

      const auditResult = await queryAuditLogs({ action: 'payout.intervention_retry' });
      assert.ok(auditResult.audit_logs.length > 0, 'Audit log must record payout intervention');
      const log = auditResult.audit_logs[0];
      assert.strictEqual(log.target_type, 'payout');
      assert.strictEqual(log.target_id, payout.id);
      assert.strictEqual(log.after_state?.status, 'processing');
    });
  });

  describe('4. Dispute Queue & Operational Workflow (§16)', () => {
    it('creates and resolves disputes with compliance role', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_dispute_user',
        account_type: 'individual',
        display_name: 'Dispute User',
        owner_name: 'Alice Wonder',
      });

      // 1. Create dispute
      const createRes = await fetch(`${baseUrl}/api/v1/admin/disputes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_support',
        },
        body: JSON.stringify({
          profile_id: profile.id,
          reason: 'Duplicate charge reported by customer',
          amount: 1500,
          currency: 'KES',
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const createData: any = await createRes.json();
      const disputeId = createData.dispute.id;

      // 2. Resolve dispute as refund
      const resolveRes = await fetch(`${baseUrl}/api/v1/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_admin_compliance',
        },
        body: JSON.stringify({
          decision: 'resolved_refund',
          resolution_notes: 'Confirmed duplicate intent ID in gateway log',
        }),
      });
      assert.strictEqual(resolveRes.status, 200);
      const resolveData: any = await resolveRes.json();
      assert.strictEqual(resolveData.dispute.status, 'resolved_refund');
      assert.strictEqual(resolveData.dispute.resolution_notes, 'Confirmed duplicate intent ID in gateway log');

      // 3. Verify audit log entry
      const auditResult = await queryAuditLogs({ action: 'dispute.resolved_refund' });
      assert.ok(auditResult.audit_logs.length > 0);
    });
  });

  describe('5. Platform Health & Derived Metrics Reporting (§16)', () => {
    it('returns real derived platform health numbers and rail indicators', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_metrics_user',
        account_type: 'business',
        display_name: 'Metrics Merchant',
        owner_name: 'Charles Babbage',
      });

      // Record a transaction
      await recordTransaction(
        {
          provider: 'loop',
          rail: 'loop',
          internal_reference: 'int-metrics-101',
          external_reference: 'ext-metrics-101',
          amount: 8000,
          currency: 'KES',
          provider_fee: 120,
          net_amount: 7880,
          payer_identifier: '254712345678',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        profile.id,
        'pi-metrics-101'
      );

      const res = await fetch(`${baseUrl}/api/v1/admin/metrics`, {
        headers: { Authorization: 'Bearer clerk_admin_support' },
      });
      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      const metrics = data.metrics;

      assert.ok(typeof metrics.total_volume === 'number', 'total_volume must be numeric');
      assert.ok(typeof metrics.total_transactions === 'number', 'total_transactions must be numeric');
      assert.ok(typeof metrics.reconciliation_rate === 'number', 'reconciliation_rate must be numeric');
      assert.ok(typeof metrics.ai_suggestion_acceptance_rate === 'number', 'ai acceptance must be numeric');
      assert.ok(Array.isArray(metrics.rails_health), 'rails_health must be an array');
      assert.ok(metrics.rails_health.length >= 2, 'Should include loop and seeded rails');

      const loopHealth = metrics.rails_health.find((r: any) => r.adapter_key === 'loop');
      assert.ok(loopHealth, 'LOOP rail health indicator must exist');
      assert.strictEqual(loopHealth.circuit_breaker_state, 'CLOSED');
    });
  });
});
