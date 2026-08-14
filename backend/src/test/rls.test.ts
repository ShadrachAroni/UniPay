import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('UniPay Row-Level Security (RLS) Verification Test Suite', () => {
  let pool: Pool;
  let adminClient: PoolClient;

  // Test fixtures IDs
  const userAClerkId = `clerk_rls_a_${Date.now()}`;
  const userBClerkId = `clerk_rls_b_${Date.now()}`;
  const supportAdminClerkId = `clerk_rls_supp_${Date.now()}`;
  const superAdminClerkId = `clerk_rls_super_${Date.now()}`;

  let userAProfileId: string;
  let userBProfileId: string;
  let userATxnId: string;
  let userBTxnId: string;

  let dbAvailable = false;

  before(async (t: any) => {
    const connStr = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
    if (!connStr) {
      if (t && typeof t.skip === 'function') t.skip('No DATABASE_URL configured for RLS integration tests');
      return;
    }
    try {
      pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 3000,
      });

      adminClient = await pool.connect();
      await adminClient.query('SELECT 1');
      dbAvailable = true;
    } catch (err: any) {
      dbAvailable = false;
      if (adminClient) {
        try { adminClient.release(); } catch {}
        adminClient = undefined as any;
      }
      if (pool) {
        try { await pool.end(); } catch {}
        pool = undefined as any;
      }
      if (t && typeof t.skip === 'function') {
        t.skip(`Database connection failed (${err.message}). Skipping RLS integration tests.`);
      }
      return;
    }

    // 1. Seed User A
    const resA = await adminClient.query(`
      INSERT INTO profiles (clerk_user_id, account_type, display_name, owner_name, phone, verification_status)
      VALUES ($1, 'individual', 'RLS User A', 'Alice A', '+254700000001', 'approved')
      RETURNING id;
    `, [userAClerkId]);
    userAProfileId = resA.rows[0].id;

    await adminClient.query(`
      INSERT INTO aliases (profile_id, alias, identifier_type)
      VALUES ($1, $2, 'alias');
    `, [userAProfileId, `alice_${Date.now()}`]);

    const txnARes = await adminClient.query(`
      INSERT INTO transactions (recipient_profile_id, provider, rail, internal_reference, external_reference, amount, currency, provider_fee, net_amount, payment_status)
      VALUES ($1, 'loop', 'mpesa', $2, $3, 1000.00, 'KES', 15.00, 985.00, 'successful')
      RETURNING id;
    `, [userAProfileId, `INT_TXN_A_${Date.now()}`, `EXT_TXN_A_${Date.now()}`]);
    userATxnId = txnARes.rows[0].id;

    await adminClient.query(`
      INSERT INTO payouts (profile_id, provider, requested_amount, requested_currency, destination_type, destination_reference, fee, net_amount, status, idempotency_key)
      VALUES ($1, 'loop', 500.00, 'KES', 'mpesa', '+254700000001', 10.00, 490.00, 'requested', $2);
    `, [userAProfileId, `PAYOUT_A_${Date.now()}`]);

    await adminClient.query(`
      INSERT INTO money_direction_rules (profile_id, destination_type, destination_reference, allocation_type, allocation_value, priority_order, is_active)
      VALUES ($1, 'bank', 'ACC-001-A', 'percentage', 15.00, 1, true);
    `, [userAProfileId]);

    // 2. Seed User B
    const resB = await adminClient.query(`
      INSERT INTO profiles (clerk_user_id, account_type, display_name, owner_name, phone, verification_status)
      VALUES ($1, 'individual', 'RLS User B', 'Bob B', '+254700000002', 'approved')
      RETURNING id;
    `, [userBClerkId]);
    userBProfileId = resB.rows[0].id;

    const txnBRes = await adminClient.query(`
      INSERT INTO transactions (recipient_profile_id, provider, rail, internal_reference, external_reference, amount, currency, provider_fee, net_amount, payment_status)
      VALUES ($1, 'loop', 'airtel', $2, $3, 2000.00, 'KES', 30.00, 1970.00, 'successful')
      RETURNING id;
    `, [userBProfileId, `INT_TXN_B_${Date.now()}`, `EXT_TXN_B_${Date.now()}`]);
    userBTxnId = txnBRes.rows[0].id;

    // 3. Seed Admins
    await adminClient.query(`
      INSERT INTO admin_users (clerk_user_id, role, permissions_json)
      VALUES ($1, 'support', '{"can_review_kyc": false, "can_manage_rails": false}'::jsonb);
    `, [supportAdminClerkId]);

    await adminClient.query(`
      INSERT INTO admin_users (clerk_user_id, role, permissions_json)
      VALUES ($1, 'super_admin', '{"can_manage_admins": true, "can_manage_rails": true}'::jsonb);
    `, [superAdminClerkId]);
  });

  after(async () => {
    if (!dbAvailable) return;
    if (adminClient) {
      try {
        // Clean up test data
        await adminClient.query('DELETE FROM money_direction_rules WHERE profile_id IN ($1, $2)', [userAProfileId, userBProfileId]);
        await adminClient.query('DELETE FROM payouts WHERE profile_id IN ($1, $2)', [userAProfileId, userBProfileId]);
        await adminClient.query('DELETE FROM transactions WHERE id IN ($1, $2)', [userATxnId, userBTxnId]);
        await adminClient.query('DELETE FROM aliases WHERE profile_id IN ($1, $2)', [userAProfileId, userBProfileId]);
        await adminClient.query('DELETE FROM profiles WHERE id IN ($1, $2)', [userAProfileId, userBProfileId]);
        await adminClient.query('DELETE FROM admin_users WHERE clerk_user_id IN ($1, $2)', [supportAdminClerkId, superAdminClerkId]);
        adminClient.release();
      } catch {}
    }
    if (pool) {
      try { await pool.end(); } catch {}
    }
  });

  describe('1. Unauthenticated & Public Access Boundaries (§19 Checkout)', () => {
    it('permits public SELECT on payment_rails for rail discovery', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SET LOCAL app.clerk_user_id = ''");
        await client.query("SET LOCAL app.admin_role = ''");

        const res = await client.query('SELECT * FROM payment_rails WHERE is_enabled = true');
        assert.ok(res.rows.length > 0, 'Public should be able to read active payment rails');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('permits public SELECT on aliases for unauthenticated checkout resolution', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SET LOCAL app.clerk_user_id = ''");

        const res = await client.query('SELECT * FROM aliases WHERE profile_id = $1', [userAProfileId]);
        assert.strictEqual(res.rows.length, 1, 'Public should resolve existing alias');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('DENIES public unauthenticated SELECT on profiles (returns 0 rows)', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SET LOCAL app.clerk_user_id = ''");

        const res = await client.query('SELECT * FROM profiles WHERE id = $1', [userAProfileId]);
        assert.strictEqual(res.rows.length, 0, 'Unauthenticated query must return 0 profiles');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('DENIES public unauthenticated SELECT on transactions (returns 0 rows)', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SET LOCAL app.clerk_user_id = ''");

        const res = await client.query('SELECT * FROM transactions WHERE id = $1', [userATxnId]);
        assert.strictEqual(res.rows.length, 0, 'Unauthenticated query must return 0 transactions');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('DENIES public unauthenticated SELECT on audit_logs and admin_users', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SET LOCAL app.clerk_user_id = ''");

        const auditRes = await client.query('SELECT * FROM audit_logs');
        assert.strictEqual(auditRes.rows.length, 0, 'Unauthenticated caller cannot read audit logs');

        const adminRes = await client.query('SELECT * FROM admin_users');
        assert.strictEqual(adminRes.rows.length, 0, 'Unauthenticated caller cannot read admin users');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  describe('2. Owner-Scoped Tenant Isolation (Positive & Negative Tests)', () => {
    it('POSITIVE: User A can read own profile, transactions, payouts, and money direction rules', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [userAClerkId]);

        // Profiles
        const profileRes = await client.query('SELECT * FROM profiles WHERE id = $1', [userAProfileId]);
        assert.strictEqual(profileRes.rows.length, 1);
        assert.strictEqual(profileRes.rows[0].display_name, 'RLS User A');

        // Transactions
        const txnRes = await client.query('SELECT * FROM transactions WHERE id = $1', [userATxnId]);
        assert.strictEqual(txnRes.rows.length, 1);
        assert.strictEqual(txnRes.rows[0].recipient_profile_id, userAProfileId);

        // Payouts
        const payoutRes = await client.query('SELECT * FROM payouts WHERE profile_id = $1', [userAProfileId]);
        assert.strictEqual(payoutRes.rows.length, 1);

        // Money Direction Rules
        const rulesRes = await client.query('SELECT * FROM money_direction_rules WHERE profile_id = $1', [userAProfileId]);
        assert.strictEqual(rulesRes.rows.length, 1);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('NEGATIVE: User A CANNOT read User B profiles or transactions (returns 0 rows)', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [userAClerkId]);

        // User A querying User B's profile
        const profileRes = await client.query('SELECT * FROM profiles WHERE id = $1', [userBProfileId]);
        assert.strictEqual(profileRes.rows.length, 0, 'User A must not see User B profile');

        // User A querying User B's transaction
        const txnRes = await client.query('SELECT * FROM transactions WHERE id = $1', [userBTxnId]);
        assert.strictEqual(txnRes.rows.length, 0, 'User A must not see User B transactions');

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('NEGATIVE: User A CANNOT directly INSERT into transactions table', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [userAClerkId]);

        await assert.rejects(
          async () => {
            await client.query(`
              INSERT INTO transactions (recipient_profile_id, provider, rail, internal_reference, external_reference, amount, currency, provider_fee, net_amount, payment_status)
              VALUES ($1, 'loop', 'mpesa', 'FORGED_INT_REF', 'FORGED_EXT_REF', 500.00, 'KES', 7.50, 492.50, 'successful');
            `, [userAProfileId]);
          },
          /new row violates row-level security policy/,
          'User session must not be allowed to directly insert transactions'
        );

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  describe('3. Admin Role Boundary Tests (§16 RBAC & RLS)', () => {
    it('Support Admin can read profiles, transactions, and audit logs', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [supportAdminClerkId]);

        const profileRes = await client.query('SELECT * FROM profiles WHERE id IN ($1, $2)', [userAProfileId, userBProfileId]);
        assert.strictEqual(profileRes.rows.length, 2, 'Support admin can read all profiles');

        const txnRes = await client.query('SELECT * FROM transactions WHERE id IN ($1, $2)', [userATxnId, userBTxnId]);
        assert.strictEqual(txnRes.rows.length, 2, 'Support admin can read all transactions');

        const adminRes = await client.query('SELECT * FROM admin_users');
        assert.ok(adminRes.rows.length >= 2, 'Support admin can read admin list');

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('Support Admin CANNOT insert into payment_rails (Super Admin only)', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [supportAdminClerkId]);

        await assert.rejects(
          async () => {
            await client.query(`
              INSERT INTO payment_rails (name, adapter_key, is_enabled, supported_currencies, supported_countries, capabilities_json)
              VALUES ('Unauthorized Rail', 'unauthorized', true, '{"KES"}', '{"KE"}', '{}'::jsonb);
            `);
          },
          /new row violates row-level security policy/,
          'Support role must be blocked by RLS on payment_rails write'
        );

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('Support Admin CANNOT create admin_users (Super Admin only)', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [supportAdminClerkId]);

        await assert.rejects(
          async () => {
            await client.query(`
              INSERT INTO admin_users (clerk_user_id, role)
              VALUES ('clerk_forged_admin', 'super_admin');
            `);
          },
          /new row violates row-level security policy/,
          'Support role must be blocked by RLS on admin_users write'
        );

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('Super Admin CAN manage payment_rails and admin_users', async (t: any) => {
      if (!dbAvailable) { if (t?.skip) t.skip('Database unavailable'); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET ROLE unipay_app_user');
        await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [superAdminClerkId]);

        // Super Admin creating a temporary test rail
        const railKey = `test_rail_${Date.now()}`;
        const railRes = await client.query(`
          INSERT INTO payment_rails (name, adapter_key, is_enabled, supported_currencies, supported_countries, capabilities_json)
          VALUES ('Super Admin Rail', $1, true, '{"KES"}', '{"KE"}', '{}'::jsonb)
          RETURNING adapter_key;
        `, [railKey]);
        assert.strictEqual(railRes.rows[0].adapter_key, railKey);

        // Super Admin creating another admin
        const newAdminClerk = `clerk_new_supp_${Date.now()}`;
        const adminRes = await client.query(`
          INSERT INTO admin_users (clerk_user_id, role)
          VALUES ($1, 'support')
          RETURNING id;
        `, [newAdminClerk]);
        assert.ok(adminRes.rows[0].id);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });
});
