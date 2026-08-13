import { Pool, PoolConfig } from 'pg';
import { env } from '../config/env';
import { rootLogger } from '../utils/logger';

/**
 * PostgreSQL Connection Pool Configuration (Handbook M1)
 * Default pool_size = 10 (tunable via DB_POOL_SIZE)
 * PgBouncer Transaction Mode compatible (no session-level state preserved across transactions)
 */
const connectionString = env.DATABASE_URL || env.DATABASE_DIRECT_URL;

const poolConfig: PoolConfig = {
  connectionString,
  max: env.DB_POOL_SIZE,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: connectionString && !connectionString.includes('localhost')
    ? { rejectUnauthorized: false }
    : undefined,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  rootLogger.error('Unexpected error on idle PostgreSQL client', {
    error: err.message,
    stack: err.stack,
  });
});

/**
 * Executes a simple query to verify database reachability
 */
export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  if (!connectionString) {
    return { ok: false, error: 'DATABASE_URL not configured' };
  }

  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1 AS health');
      return { ok: true, latencyMs: Date.now() - start };
    } finally {
      client.release();
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
