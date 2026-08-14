import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const directUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log('=== 1. POSTGRES CONNECTION ROLE & PRIVILEGES ===');
    const roleRes = await client.query(`
      SELECT 
        current_user, 
        session_user, 
        current_database(),
        r.rolsuper,
        r.rolinherit,
        r.rolcreaterole,
        r.rolcreatedb,
        r.rolcanlogin,
        r.rolreplication,
        r.rolbypassrls
      FROM pg_roles r
      WHERE r.rolname = current_user;
    `);
    console.log(JSON.stringify(roleRes.rows, null, 2));

    console.log('\n=== 2. TABLE-BY-TABLE RLS STATUS ===');
    const tablesRes = await client.query(`
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled,
        c.relforcerowsecurity as rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `);
    console.log(JSON.stringify(tablesRes.rows, null, 2));

    console.log('\n=== 3. EXISTING POLICIES (pg_policies) ===');
    const policiesRes = await client.query(`
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
    console.log(`Total policies found: ${policiesRes.rows.length}`);
    console.log(JSON.stringify(policiesRes.rows, null, 2));

    console.log('\n=== 4. CUSTOM AUTH / JWT SCHEMAS OR FUNCTIONS ===');
    const funcsRes = await client.query(`
      SELECT 
        n.nspname as schema,
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public', 'app', 'auth')
      ORDER BY n.nspname, p.proname;
    `);
    console.log(JSON.stringify(funcsRes.rows, null, 2));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('RLS check error:', err);
  process.exit(1);
});
