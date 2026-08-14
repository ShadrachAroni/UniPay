import crypto from 'crypto';
import { pool } from '../db';
import { rootLogger } from '../utils/logger';

export interface IdempotencyRecord {
  id: string;
  idempotency_key: string;
  route: string;
  user_id?: string | null;
  request_hash: string;
  status_code: number;
  response_body: Record<string, unknown>;
  created_at: string;
}

// In-memory cache fallback when postgres is unavailable in local testing
const inMemoryStore = new Map<string, IdempotencyRecord>();

export function computeRequestHash(body: unknown): string {
  const normalized = JSON.stringify(body || {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function getIdempotencyRecord(
  key: string
): Promise<IdempotencyRecord | null> {
  try {
    const { rows } = await pool.query(
      `SELECT id, idempotency_key, route, user_id, request_hash, status_code, response_body, created_at
       FROM idempotency_records
       WHERE idempotency_key = $1
       LIMIT 1`,
      [key]
    );

    if (rows.length > 0) {
      return rows[0] as IdempotencyRecord;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for idempotency lookup', {
      error: (err as Error).message,
    });
  }

  return inMemoryStore.get(key) || null;
}

export async function saveIdempotencyRecord(
  key: string,
  route: string,
  userId: string | undefined,
  requestHash: string,
  statusCode: number,
  responseBody: Record<string, unknown>
): Promise<void> {
  const record: IdempotencyRecord = {
    id: crypto.randomUUID(),
    idempotency_key: key,
    route,
    user_id: userId || null,
    request_hash: requestHash,
    status_code: statusCode,
    response_body: responseBody,
    created_at: new Date().toISOString(),
  };

  // Populate in-memory store immediately to prevent race conditions on rapid retries
  inMemoryStore.set(key, record);

  try {
    await pool.query(
      `INSERT INTO idempotency_records 
        (idempotency_key, route, user_id, request_hash, status_code, response_body)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [key, route, userId || null, requestHash, statusCode, JSON.stringify(responseBody)]
    );
  } catch (err) {
    rootLogger.debug('Falling back to memory for saving idempotency record', {
      error: (err as Error).message,
    });
  }
}

export function clearIdempotencyCache(): void {
  inMemoryStore.clear();
}
