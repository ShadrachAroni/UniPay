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
    console.log('Updating helper functions with SECURITY DEFINER...');
    await client.query(`
      CREATE OR REPLACE FUNCTION app.current_profile_id()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, app
      AS $$
          SELECT COALESCE(
              NULLIF(current_setting('app.profile_id', true), '')::uuid,
              (SELECT id FROM public.profiles WHERE clerk_user_id = app.current_clerk_id() LIMIT 1)
          );
      $$;

      CREATE OR REPLACE FUNCTION app.current_admin_role()
      RETURNS TEXT
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, app
      AS $$
          SELECT COALESCE(
              NULLIF(current_setting('app.admin_role', true), ''),
              (SELECT role FROM public.admin_users WHERE clerk_user_id = app.current_clerk_id() LIMIT 1)
          );
      $$;

      CREATE OR REPLACE FUNCTION app.is_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, app
      AS $$
          SELECT app.current_admin_role() IS NOT NULL;
      $$;

      CREATE OR REPLACE FUNCTION app.is_super_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, app
      AS $$
          SELECT app.current_admin_role() = 'super_admin';
      $$;
    `);
    console.log('Functions updated successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Function update error:', err);
  process.exit(1);
});
