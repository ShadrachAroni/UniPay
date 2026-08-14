import crypto from 'crypto';
import { pool } from '../db';
import { rootLogger } from '../utils/logger';
import { AuditLog, AuditLogActorType } from '@unipay/shared';

// In-memory fallback store for offline tests and DB unreachability
const inMemoryAuditLogs: AuditLog[] = [];

export interface LogAdminActionParams {
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  actor_type?: AuditLogActorType;
}

export interface AuditLogFilters {
  actor_id?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

/**
 * Log an administrative or system action to immutable audit trail (§11, §16, §19)
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<AuditLog> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const actorType: AuditLogActorType = params.actor_type || 'admin';

  // Sanitize states to strip raw sensitive PII before persistence (§19)
  const sanitize = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj };
    if (copy.id_number) copy.id_number = '***MASKED***';
    if (copy.id_document_url) copy.id_document_url = '***MASKED***';
    if (copy.id_selfie_url) copy.id_selfie_url = '***MASKED***';
    return copy;
  };

  const beforeState = sanitize(params.before_state);
  const afterState = sanitize(params.after_state);

  const logEntry: AuditLog = {
    id,
    actor_type: actorType,
    actor_id: params.actor_id,
    action: params.action,
    target_type: params.target_type,
    target_id: params.target_id,
    before_state: beforeState || null,
    after_state: afterState || null,
    created_at: now,
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO audit_logs 
        (id, actor_type, actor_id, action, target_type, target_id, before_state, after_state, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        logEntry.id,
        logEntry.actor_type,
        logEntry.actor_id,
        logEntry.action,
        logEntry.target_type,
        logEntry.target_id,
        logEntry.before_state ? JSON.stringify(logEntry.before_state) : null,
        logEntry.after_state ? JSON.stringify(logEntry.after_state) : null,
        logEntry.created_at,
      ]
    );

    if (rows.length > 0) {
      inMemoryAuditLogs.unshift(rows[0]);
      return rows[0];
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for audit_logs', {
      error: (err as Error).message,
    });
  }

  inMemoryAuditLogs.unshift(logEntry);
  return logEntry;
}

export async function queryAuditLogs(filters: AuditLogFilters = {}): Promise<{ audit_logs: AuditLog[]; total: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (filters.actor_id) {
      conditions.push(`actor_id = $${paramIdx++}`);
      values.push(filters.actor_id);
    }
    if (filters.action) {
      conditions.push(`action = $${paramIdx++}`);
      values.push(filters.action);
    }
    if (filters.target_type) {
      conditions.push(`target_type = $${paramIdx++}`);
      values.push(filters.target_type);
    }
    if (filters.target_id) {
      conditions.push(`target_id = $${paramIdx++}`);
      values.push(filters.target_id);
    }
    if (filters.date_from) {
      conditions.push(`created_at >= $${paramIdx++}`);
      values.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push(`created_at <= $${paramIdx++}`);
      values.push(filters.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = parseInt(countRows[0]?.count || '0', 10);

    const query = `
      SELECT * FROM audit_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    const { rows } = await pool.query(query, [...values, limit, offset]);

    return {
      audit_logs: rows,
      total,
    };
  } catch (err) {
    rootLogger.debug('Falling back to memory store for queryAuditLogs', {
      error: (err as Error).message,
    });
  }

  let filtered = inMemoryAuditLogs.filter((log) => {
    if (filters.actor_id && log.actor_id !== filters.actor_id) return false;
    if (filters.action && log.action !== filters.action) return false;
    if (filters.target_type && log.target_type !== filters.target_type) return false;
    if (filters.target_id && log.target_id !== filters.target_id) return false;
    if (filters.date_from && new Date(log.created_at) < new Date(filters.date_from)) return false;
    if (filters.date_to && new Date(log.created_at) > new Date(filters.date_to)) return false;
    return true;
  });

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    audit_logs: paginated,
    total,
  };
}

export function clearAuditLogCache(): void {
  inMemoryAuditLogs.length = 0;
}
