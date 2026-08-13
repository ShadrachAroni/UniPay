import { Client } from 'pg';

const regions = [
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-south-1',
  'af-south-1',
  'sa-east-1',
];

const projectId = 'wpdcntiurqfxlkoegief';
const password = 'Mokua@Aroni52';

async function testRegions() {
  for (const r of regions) {
    const host = `aws-0-${r}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.${projectId}:${encodeURIComponent(password)}@${host}:6543/postgres`;
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 2500,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      const res = await client.query('SELECT 1 as connected');
      console.log(`>>> SUCCESS on region: ${r}!`, res.rows);
      await client.end();
      return r;
    } catch (err: any) {
      if (!err.message.includes('tenant/user') && !err.message.includes('ENOTFOUND') && !err.message.includes('timeout')) {
        console.log(`Response on ${r}: ${err.message}`);
      }
      try { await client.end(); } catch (_) {}
    }
  }
  console.log('No region matched.');
}

testRegions();
