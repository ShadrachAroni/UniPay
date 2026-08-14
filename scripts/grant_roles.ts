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
    console.log('Granting unipay_app_user, anon, authenticated to postgres...');
    await client.query('GRANT unipay_app_user, anon, authenticated TO postgres;');
    console.log('Grant successful!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Grant error:', err);
  process.exit(1);
});
