import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_DIRECT_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000,
});

async function runAudit() {
  try {
    console.log('==================================================');
    console.log('UNIPAY LIVE DATABASE AUDIT REPORT (DETAILED)');
    console.log('==================================================\n');

    // 0. Connection & Server Info
    const serverInfo = await pool.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        session_user as session_user,
        inet_server_addr() as server_addr,
        inet_server_port() as server_port,
        version() as pg_version,
        current_setting('max_connections') as max_connections,
        current_setting('server_version') as server_version
    `);
    console.log('--- 0. Connection & DB Info ---');
    console.log(JSON.stringify(serverInfo.rows[0], null, 2));

    // 1. Migration state
    console.log('\n--- 1. Migration State Audit ---');
    const applied = await pool.query('SELECT id, name, applied_at FROM _unipay_migrations ORDER BY id ASC');
    console.log(`Applied migrations (${applied.rows.length} total):`);
    console.table(applied.rows);

    const backendMigrationsDir = path.resolve(__dirname, '../backend/src/migrations');
    const rootMigrationsDir = path.resolve(__dirname, '../migrations');

    const backendFiles = fs.existsSync(backendMigrationsDir) ? fs.readdirSync(backendMigrationsDir).filter(f => f.endsWith('.sql')).sort() : [];
    const rootFiles = fs.existsSync(rootMigrationsDir) ? fs.readdirSync(rootMigrationsDir).filter(f => f.endsWith('.sql')).sort() : [];

    console.log('Backend migration files on disk:', backendFiles);
    console.log('Root migration files on disk:', rootFiles);

    // Check drift
    const appliedNames = new Set(applied.rows.map(r => r.name));
    const backendNames = new Set(backendFiles.map(f => path.parse(f).name));
    const unapplied = backendFiles.filter(f => !appliedNames.has(path.parse(f).name));
    const outOfBand = applied.rows.filter(r => !backendNames.has(r.name));

    console.log('Unapplied migration files:', unapplied);
    console.log('Out-of-band applied migrations (no disk file):', outOfBand);

    // 2. Tables & Schema Correctness
    console.log('\n--- 2. Tables in Public Schema ---');
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const existingTables = tablesRes.rows.map(r => r.table_name);
    console.log('Existing tables in public schema:', existingTables);

    // Check all tables specified in §11
    const targetTables = [
      'profiles', 'aliases', 'payment_intents', 'transactions', 'settlements',
      'reconciliation_matches', 'payouts', 'money_direction_rules', 'payment_rails',
      'admin_users', 'audit_logs', 'ai_interactions', 'expected_payments',
      'payment_pools', 'pool_contributions', 'disputes', 'reconciliation_exceptions',
      'idempotency_records', 'webhook_events', 'outbox_events'
    ];

    console.log('\nMissing §11 / Phase 4B tables:');
    const missingTables = targetTables.filter(t => !existingTables.includes(t));
    console.log(missingTables);

    console.log('\n--- Detailed Table Schema Audit ---');
    for (const table of existingTables) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      console.log(`\nTable: ${table} (${cols.rows.length} columns)`);
      console.table(cols.rows);
    }

    // Foreign Keys
    console.log('\n--- Foreign Key Constraints ---');
    const fkRes = await pool.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    console.table(fkRes.rows);

    // Unique & Primary Key Constraints
    console.log('\n--- Unique Constraints & Primary Keys ---');
    const ucRes = await pool.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    console.table(ucRes.rows);

    // 3. Indexes & Stats
    console.log('\n--- 3. User Indexes & Definitions ---');
    const indexRes = await pool.query(`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    console.table(indexRes.rows);

    // 4. Hot-Path Queries EXPLAIN ANALYZE
    console.log('\n--- 3b. EXPLAIN ANALYZE on Hot-Path Queries ---');
    
    // Checkout query: Find payment intent by idempotency_key
    const exp1 = await pool.query(`EXPLAIN ANALYZE SELECT * FROM payment_intents WHERE idempotency_key = 'test-key-123'`);
    console.log('\nQuery: SELECT FROM payment_intents WHERE idempotency_key = ...');
    console.log(exp1.rows.map(r => r['QUERY PLAN']).join('\n'));

    // Dashboard query: Transactions for recipient profile with status
    const exp2 = await pool.query(`EXPLAIN ANALYZE SELECT * FROM transactions WHERE recipient_profile_id = '00000000-0000-0000-0000-000000000000' AND payment_status = 'successful' ORDER BY transaction_time DESC LIMIT 20`);
    console.log('\nQuery: SELECT FROM transactions WHERE recipient_profile_id = ... AND payment_status = ...');
    console.log(exp2.rows.map(r => r['QUERY PLAN']).join('\n'));

    // Reconciliation query: Matches for profile
    const exp3 = await pool.query(`EXPLAIN ANALYZE SELECT * FROM reconciliation_matches WHERE profile_id = '00000000-0000-0000-0000-000000000000'`);
    console.log('\nQuery: SELECT FROM reconciliation_matches WHERE profile_id = ...');
    console.log(exp3.rows.map(r => r['QUERY PLAN']).join('\n'));

    // 5. Row-Level Security (RLS) State
    console.log('\n--- 4. Row Level Security (RLS) State ---');
    const rlsRes = await pool.query(`
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `);
    console.table(rlsRes.rows);

    const policiesRes = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    console.log(`\nExisting RLS Policies (${policiesRes.rows.length} found):`);
    console.table(policiesRes.rows);

    // 6. Sensitive Data Audit
    console.log('\n--- 5. Sensitive Data & Storage Check ---');
    for (const tbl of ['profiles', 'transactions', 'payouts', 'payment_intents', 'payment_rails', 'admin_users', 'audit_logs', 'ai_interactions']) {
      if (existingTables.includes(tbl)) {
        const count = await pool.query(`SELECT count(*) FROM "${tbl}"`);
        console.log(`Table ${tbl}: ${count.rows[0].count} rows`);
      }
    }

    // Check payment_rails seeded rows
    const rails = await pool.query(`SELECT id, name, adapter_key, is_enabled, supported_currencies, min_amount, max_amount FROM payment_rails`);
    console.log('\nPayment Rails:');
    console.table(rails.rows);

  } catch (err) {
    console.error('Audit failed with error:', err);
  } finally {
    await pool.end();
  }
}

runAudit();
