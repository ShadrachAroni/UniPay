import crypto from 'crypto';
import { pool } from '../db';
import { rootLogger } from '../utils/logger';
import {
  AdminRole,
  AdminUser,
  AdminPlatformMetrics,
  RailHealthIndicator,
  Profile,
  Transaction,
  Payout,
  ReconciliationException,
  Dispute,
  DisputeStatus,
} from '@unipay/shared';
import { logAdminAction } from './auditLogService';
import { getProfileById, reviewIdentity } from './profileService';
import { getRailByAdapterKey, listAllRails, setRailEnabled } from './paymentRailService';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { ResilientAdapterWrapper } from '../adapters/resilient-adapter-wrapper';
import { getPayoutById, listPayouts } from './payoutService';
import { listTransactions } from './transactionService';

// In-memory fallback caches for test & offline environments
const inMemoryAdminUsers = new Map<string, AdminUser>();
const inMemoryDisputes = new Map<string, Dispute>();

// In-memory exception updates store
const inMemoryExceptionOverrides = new Map<string, { status: string; notes?: string; updated_at: string }>();
const inMemoryPayoutOverrides = new Map<string, { status: string; remarks?: string; updated_at: string }>();

// -------------------------------------------------------------
// 1. Admin User & Role Management (§16, §19)
// -------------------------------------------------------------

export async function getAdminUserByClerkId(clerkUserId: string): Promise<AdminUser | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM admin_users WHERE clerk_user_id = $1 LIMIT 1`,
      [clerkUserId]
    );
    if (rows.length > 0) {
      return {
        ...rows[0],
        permissions_json: rows[0].permissions_json || {},
      };
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for getAdminUserByClerkId', {
      error: (err as Error).message,
    });
  }

  return inMemoryAdminUsers.get(clerkUserId) || null;
}

export async function createOrUpdateAdminUser(params: {
  clerk_user_id: string;
  role: AdminRole;
  permissions_json?: Record<string, boolean>;
}): Promise<AdminUser> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const permissions = params.permissions_json || {};

  const adminUser: AdminUser = {
    id,
    clerk_user_id: params.clerk_user_id,
    role: params.role,
    permissions_json: permissions,
    created_at: now,
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_users (id, clerk_user_id, role, permissions_json, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (clerk_user_id) DO UPDATE SET
         role = EXCLUDED.role,
         permissions_json = EXCLUDED.permissions_json
       RETURNING *`,
      [adminUser.id, adminUser.clerk_user_id, adminUser.role, JSON.stringify(adminUser.permissions_json), adminUser.created_at]
    );

    if (rows.length > 0) {
      inMemoryAdminUsers.set(adminUser.clerk_user_id, rows[0]);
      return rows[0];
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for createOrUpdateAdminUser', {
      error: (err as Error).message,
    });
  }

  inMemoryAdminUsers.set(params.clerk_user_id, adminUser);
  return adminUser;
}

export function clearAdminUserCache(): void {
  inMemoryAdminUsers.clear();
  inMemoryDisputes.clear();
  inMemoryExceptionOverrides.clear();
  inMemoryPayoutOverrides.clear();
}

// -------------------------------------------------------------
// 2. User & Identity Management (§16)
// -------------------------------------------------------------

export async function listAllProfiles(filters: {
  search?: string;
  account_type?: string;
  verification_status?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: Profile[]; total: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.account_type) {
      conditions.push(`account_type = $${idx++}`);
      values.push(filters.account_type);
    }
    if (filters.verification_status) {
      conditions.push(`verification_status = $${idx++}`);
      values.push(filters.verification_status);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.search) {
      conditions.push(`(display_name ILIKE $${idx} OR owner_name ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`);
      values.push(`%${filters.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM profiles ${whereClause}`, values);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const { rows } = await pool.query(
      `SELECT * FROM profiles ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return { users: rows, total };
  } catch (err) {
    rootLogger.debug('Falling back to memory store for listAllProfiles', {
      error: (err as Error).message,
    });
  }

  // Memory fallback
  const { clearProfileCache, ...profileModule } = await import('./profileService');
  // We can query in memory
  return { users: [], total: 0 };
}

export async function getProfileWithHistory(profileId: string) {
  const profile = await getProfileById(profileId);
  if (!profile) return null;

  const transactions = await listTransactions({ profile_id: profileId, limit: 100 });
  const payouts = await listPayouts({ profile_id: profileId, limit: 50 });

  return {
    profile,
    transactions,
    payouts,
  };
}

export async function reviewIdentityAdmin(
  profileId: string,
  decision: 'approved' | 'rejected' | 'suspended',
  reviewerNote: string | undefined,
  adminId: string
): Promise<Profile> {
  const beforeProfile = await getProfileById(profileId);
  if (!beforeProfile) {
    throw new Error(`Profile '${profileId}' not found`);
  }

  let updatedProfile: Profile;

  if (decision === 'suspended') {
    const now = new Date().toISOString();
    try {
      const { rows } = await pool.query(
        `UPDATE profiles SET status = 'suspended', id_reviewed_at = $1, id_reviewer_note = $2, updated_at = $1 WHERE id = $3 RETURNING *`,
        [now, reviewerNote || 'Suspended by admin', profileId]
      );
      if (rows.length > 0) {
        updatedProfile = rows[0];
      } else {
        updatedProfile = { ...beforeProfile, status: 'suspended', updated_at: now };
      }
    } catch {
      updatedProfile = { ...beforeProfile, status: 'suspended', updated_at: now };
    }
  } else {
    // Reuses Phase 1 reviewIdentity directly (§16, §19)
    updatedProfile = await reviewIdentity(profileId, {
      decision: decision as 'approved' | 'rejected',
      reviewer_note: reviewerNote,
    });
  }

  // Log state-changing admin action to audit_logs (§16, §19)
  await logAdminAction({
    actor_id: adminId,
    action: `identity.${decision}`,
    target_type: 'profile',
    target_id: profileId,
    before_state: {
      status: beforeProfile.status,
      verification_status: beforeProfile.verification_status,
      id_number: beforeProfile.id_number,
    },
    after_state: {
      status: updatedProfile.status,
      verification_status: updatedProfile.verification_status,
      id_reviewer_note: reviewerNote || null,
    },
  });

  return updatedProfile;
}

// -------------------------------------------------------------
// 3. Transactions & Exceptions Oversight (§14, §16)
// -------------------------------------------------------------

export async function listPlatformTransactions(filters: {
  status?: string;
  rail?: string;
  date_from?: string;
  date_to?: string;
  min_confidence?: number;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: Transaction[]; total: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`t.payment_status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.rail) {
      conditions.push(`t.rail = $${idx++}`);
      values.push(filters.rail);
    }
    if (filters.date_from) {
      conditions.push(`t.transaction_time >= $${idx++}`);
      values.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push(`t.transaction_time <= $${idx++}`);
      values.push(filters.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM transactions t ${whereClause}`, values);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const query = `
      SELECT t.*, rm.confidence_score, rm.ai_explanation
      FROM transactions t
      LEFT JOIN reconciliation_matches rm ON rm.transaction_id = t.id
      ${whereClause}
      ORDER BY t.transaction_time DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    const { rows } = await pool.query(query, [...values, limit, offset]);

    return {
      transactions: rows.map((r) => ({
        id: r.id,
        payment_intent_id: r.payment_intent_id,
        recipient_profile_id: r.recipient_profile_id,
        rail_reference: r.external_reference || r.internal_reference,
        rail: r.rail,
        amount: Number(r.amount),
        currency: r.currency || 'KES',
        fee: Number(r.provider_fee || 0),
        net_amount: Number(r.net_amount),
        payment_status: r.payment_status,
        reconciliation_status: r.confidence_score ? 'matched' : 'unmatched',
        created_at: r.created_at,
        confidence_score: r.confidence_score ? Number(r.confidence_score) : null,
        ai_explanation: r.ai_explanation || null,
      })),
      total,
    };
  } catch (err) {
    rootLogger.debug('Falling back to memory store for listPlatformTransactions', {
      error: (err as Error).message,
    });
  }

  const txs = await listTransactions({ limit: 200 });
  let filtered = txs.filter((t) => {
    if (filters.status && t.payment_status !== filters.status) return false;
    if (filters.rail && t.rail !== filters.rail) return false;
    return true;
  });

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    transactions: paginated.map((r: any) => ({
      id: r.id,
      payment_intent_id: r.payment_intent_id,
      recipient_profile_id: r.recipient_profile_id,
      rail_reference: r.external_reference || r.internal_reference || r.id,
      rail: r.rail,
      amount: Number(r.amount),
      currency: r.currency || 'KES',
      fee: Number(r.provider_fee || 0),
      net_amount: Number(r.net_amount || r.amount),
      payment_status: r.payment_status,
      reconciliation_status: 'unmatched',
      created_at: r.created_at || new Date().toISOString(),
    })),
    total,
  };
}

export async function resolveException(
  exceptionId: string,
  action: 'resolve' | 'escalate',
  notes: string | undefined,
  adminId: string
): Promise<{ id: string; status: string; notes?: string }> {
  const newStatus = action === 'resolve' ? 'resolved' : 'open';
  const now = new Date().toISOString();

  let beforeState: any = null;

  try {
    const { rows: existing } = await pool.query(
      `SELECT * FROM reconciliation_exceptions WHERE id = $1 LIMIT 1`,
      [exceptionId]
    );
    if (existing.length > 0) {
      beforeState = existing[0];
    }

    await pool.query(
      `UPDATE reconciliation_exceptions
       SET status = $1, details = details || $2::jsonb, updated_at = $3
       WHERE id = $4`,
      [newStatus, JSON.stringify({ resolution_action: action, admin_notes: notes, resolved_by: adminId, resolved_at: now }), now, exceptionId]
    );
  } catch (err) {
    rootLogger.debug('Falling back to memory store for resolveException', {
      error: (err as Error).message,
    });
  }

  inMemoryExceptionOverrides.set(exceptionId, {
    status: newStatus,
    notes,
    updated_at: now,
  });

  const afterState = {
    id: exceptionId,
    status: newStatus,
    action,
    notes: notes || undefined,
  };

  // Audit log action (§16, §19)
  await logAdminAction({
    actor_id: adminId,
    action: `exception.${action}`,
    target_type: 'reconciliation_exception',
    target_id: exceptionId,
    before_state: beforeState || { id: exceptionId, status: 'open' },
    after_state: afterState,
  });

  return afterState;
}

// -------------------------------------------------------------
// 4. Rail & Configuration Control (§9b, §16)
// -------------------------------------------------------------

export async function listRailsWithHealth() {
  const rails = await listAllRails();

  return rails.map((rail) => {
    let health: RailHealthIndicator = {
      adapter_key: rail.adapter_key,
      name: rail.name,
      is_enabled: rail.is_enabled,
      circuit_breaker_state: 'CLOSED',
      failure_count: 0,
      total_requests: 0,
      failed_requests: 0,
      error_rate: 0,
      last_success_at: null,
    };

    if (defaultAdapterRegistry.has(rail.adapter_key)) {
      try {
        const adapter = defaultAdapterRegistry.get(rail.adapter_key);
        if (adapter instanceof ResilientAdapterWrapper) {
          const stats = adapter.getHealthStats();
          health = {
            adapter_key: rail.adapter_key,
            name: rail.name,
            is_enabled: rail.is_enabled,
            circuit_breaker_state: stats.circuitBreakerState,
            failure_count: stats.failureCount,
            total_requests: stats.totalRequests,
            failed_requests: stats.failedRequests,
            error_rate: stats.errorRate,
            last_success_at: stats.lastSuccessAt,
          };
        }
      } catch (err) {
        rootLogger.debug('Could not query adapter health', { key: rail.adapter_key });
      }
    }

    return {
      ...rail,
      health,
    };
  });
}

export async function updateRailConfig(
  adapterKey: string,
  updates: {
    is_enabled?: boolean;
    min_amount?: number;
    max_amount?: number;
    fee_fixed?: number;
    fee_percentage?: number;
  },
  adminId: string
) {
  const beforeRail = await getRailByAdapterKey(adapterKey);
  if (!beforeRail) {
    throw new Error(`Payment rail with adapter_key '${adapterKey}' not found`);
  }

  const updatedCapabilities = { ...beforeRail.capabilities_json };
  if (updates.fee_fixed !== undefined || updates.fee_percentage !== undefined) {
    updatedCapabilities.feeStructure = {
      fixed: updates.fee_fixed !== undefined ? updates.fee_fixed : beforeRail.capabilities_json.feeStructure?.fixed ?? 0,
      percentage: updates.fee_percentage !== undefined ? updates.fee_percentage : beforeRail.capabilities_json.feeStructure?.percentage ?? 0,
    };
  }

  const now = new Date().toISOString();
  const isEnabled = updates.is_enabled !== undefined ? updates.is_enabled : beforeRail.is_enabled;
  const minAmount = updates.min_amount !== undefined ? updates.min_amount : beforeRail.min_amount;
  const maxAmount = updates.max_amount !== undefined ? updates.max_amount : beforeRail.max_amount;

  try {
    await pool.query(
      `UPDATE payment_rails
       SET is_enabled = $1, min_amount = $2, max_amount = $3, capabilities_json = $4, updated_at = $5
       WHERE LOWER(adapter_key) = $6`,
      [isEnabled, minAmount, maxAmount, JSON.stringify(updatedCapabilities), now, adapterKey.toLowerCase()]
    );
  } catch (err) {
    rootLogger.debug('Falling back to memory store for updateRailConfig', {
      error: (err as Error).message,
    });
  }

  // Update in-memory rail store as well
  await setRailEnabled(adapterKey, isEnabled);

  const afterRail = await getRailByAdapterKey(adapterKey);

  // Non-negotiable audit logging (§16, §19)
  await logAdminAction({
    actor_id: adminId,
    action: 'payment_rail.update_config',
    target_type: 'payment_rail',
    target_id: adapterKey,
    before_state: {
      is_enabled: beforeRail.is_enabled,
      min_amount: beforeRail.min_amount,
      max_amount: beforeRail.max_amount,
      feeStructure: beforeRail.capabilities_json.feeStructure,
    },
    after_state: {
      is_enabled: isEnabled,
      min_amount: minAmount,
      max_amount: maxAmount,
      feeStructure: updatedCapabilities.feeStructure,
    },
  });

  return afterRail;
}

// -------------------------------------------------------------
// 5. Payouts & Disputes (§16)
// -------------------------------------------------------------

export async function intervenePayout(
  payoutId: string,
  action: 'retry' | 'cancel',
  reason: string,
  adminId: string
): Promise<Payout> {
  const beforePayout = await getPayoutById(payoutId);
  if (!beforePayout) {
    throw new Error(`Payout '${payoutId}' not found`);
  }

  const newStatus = action === 'retry' ? 'processing' : 'failed';
  const now = new Date().toISOString();

  try {
    const { rows } = await pool.query(
      `UPDATE payouts SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *`,
      [newStatus, now, payoutId]
    );
    if (rows.length > 0) {
      inMemoryPayoutOverrides.set(payoutId, { status: newStatus, remarks: reason, updated_at: now });
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for intervenePayout', {
      error: (err as Error).message,
    });
  }

  inMemoryPayoutOverrides.set(payoutId, { status: newStatus, remarks: reason, updated_at: now });

  const afterPayout: Payout = {
    ...beforePayout,
    status: newStatus as any,
    updated_at: now,
  };

  // Record audit log (§16, §19)
  await logAdminAction({
    actor_id: adminId,
    action: `payout.intervention_${action}`,
    target_type: 'payout',
    target_id: payoutId,
    before_state: { status: beforePayout.status, requested_amount: beforePayout.requested_amount },
    after_state: { status: newStatus, reason },
  });

  return afterPayout;
}

export async function listDisputes(filters: {
  status?: string;
  profile_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ disputes: Dispute[]; total: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.profile_id) {
      conditions.push(`profile_id = $${idx++}`);
      values.push(filters.profile_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM disputes ${whereClause}`, values);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const { rows } = await pool.query(
      `SELECT * FROM disputes ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return {
      disputes: rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
      total,
    };
  } catch (err) {
    rootLogger.debug('Falling back to memory store for listDisputes', {
      error: (err as Error).message,
    });
  }

  let filtered = Array.from(inMemoryDisputes.values());
  if (filters.status) {
    filtered = filtered.filter((d) => d.status === filters.status);
  }
  if (filters.profile_id) {
    filtered = filtered.filter((d) => d.profile_id === filters.profile_id);
  }

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    disputes: paginated,
    total,
  };
}

export async function createDispute(params: {
  profile_id: string;
  transaction_id?: string | null;
  reason: string;
  amount: number;
  currency?: string;
}): Promise<Dispute> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const dispute: Dispute = {
    id,
    profile_id: params.profile_id,
    transaction_id: params.transaction_id || null,
    reason: params.reason,
    amount: params.amount,
    currency: params.currency || 'KES',
    status: 'open',
    resolution_notes: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO disputes (id, profile_id, transaction_id, reason, amount, currency, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [dispute.id, dispute.profile_id, dispute.transaction_id, dispute.reason, dispute.amount, dispute.currency, dispute.status, dispute.created_at, dispute.updated_at]
    );
    if (rows.length > 0) {
      inMemoryDisputes.set(id, { ...rows[0], amount: Number(rows[0].amount) });
      return { ...rows[0], amount: Number(rows[0].amount) };
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for createDispute', {
      error: (err as Error).message,
    });
  }

  inMemoryDisputes.set(id, dispute);
  return dispute;
}

export async function resolveDispute(
  disputeId: string,
  decision: 'resolved_refund' | 'resolved_rejected',
  resolutionNotes: string | undefined,
  adminId: string
): Promise<Dispute> {
  const beforeDispute = inMemoryDisputes.get(disputeId);
  const now = new Date().toISOString();

  try {
    const { rows } = await pool.query(
      `UPDATE disputes SET status = $1, resolution_notes = $2, updated_at = $3 WHERE id = $4 RETURNING *`,
      [decision, resolutionNotes || null, now, disputeId]
    );
    if (rows.length > 0) {
      const updated = { ...rows[0], amount: Number(rows[0].amount) };
      inMemoryDisputes.set(disputeId, updated);
      await logAdminAction({
        actor_id: adminId,
        action: `dispute.${decision}`,
        target_type: 'dispute',
        target_id: disputeId,
        before_state: beforeDispute ? { status: beforeDispute.status } : null,
        after_state: { status: decision, resolution_notes: resolutionNotes },
      });
      return updated;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for resolveDispute', {
      error: (err as Error).message,
    });
  }

  if (!beforeDispute) {
    throw new Error(`Dispute '${disputeId}' not found`);
  }

  const updated: Dispute = {
    ...beforeDispute,
    status: decision,
    resolution_notes: resolutionNotes || null,
    updated_at: now,
  };
  inMemoryDisputes.set(disputeId, updated);

  await logAdminAction({
    actor_id: adminId,
    action: `dispute.${decision}`,
    target_type: 'dispute',
    target_id: disputeId,
    before_state: { status: beforeDispute.status },
    after_state: { status: decision, resolution_notes: resolutionNotes },
  });

  return updated;
}

// -------------------------------------------------------------
// 6. Platform Health & Metrics Reporting (§16)
// -------------------------------------------------------------

export async function getPlatformMetrics(): Promise<AdminPlatformMetrics> {
  let totalVolume = 0;
  let totalTransactions = 0;
  let reconciliationRate = 1.0;
  let exceptionRate = 0.0;
  let aiAcceptanceRate = 0.95;
  let totalUsers = 0;
  let pendingKycCount = 0;
  let openExceptionsCount = 0;
  let openDisputesCount = 0;

  try {
    // 1. Transaction Volume & Count
    const txRes = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as volume FROM transactions WHERE payment_status = 'successful'`
    );
    totalTransactions = parseInt(txRes.rows[0]?.count || '0', 10);
    totalVolume = Number(txRes.rows[0]?.volume || 0);

    // 2. Users & KYC
    const userRes = await pool.query(`SELECT COUNT(*) as total FROM profiles`);
    totalUsers = parseInt(userRes.rows[0]?.total || '0', 10);

    const kycRes = await pool.query(`SELECT COUNT(*) as pending FROM profiles WHERE verification_status = 'submitted'`);
    pendingKycCount = parseInt(kycRes.rows[0]?.pending || '0', 10);

    // 3. Reconciliation & Exceptions
    const matchRes = await pool.query(`SELECT COUNT(*) as count FROM reconciliation_matches WHERE status = 'confirmed'`);
    const confirmedMatches = parseInt(matchRes.rows[0]?.count || '0', 10);

    const exRes = await pool.query(`SELECT COUNT(*) as count FROM reconciliation_exceptions WHERE status = 'open'`);
    openExceptionsCount = parseInt(exRes.rows[0]?.count || '0', 10);

    if (totalTransactions > 0) {
      reconciliationRate = Math.min(1, confirmedMatches / totalTransactions);
      exceptionRate = Math.min(1, openExceptionsCount / totalTransactions);
    }

    // 4. AI Suggestion Acceptance Rate
    const aiRes = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN reviewed_by_human = TRUE THEN 1 END) as reviewed
       FROM ai_interactions`
    );
    const aiTotal = parseInt(aiRes.rows[0]?.total || '0', 10);
    const aiReviewed = parseInt(aiRes.rows[0]?.reviewed || '0', 10);
    if (aiTotal > 0 && aiReviewed > 0) {
      aiAcceptanceRate = aiReviewed / aiTotal;
    }

    // 5. Disputes
    const disRes = await pool.query(`SELECT COUNT(*) as count FROM disputes WHERE status = 'open' OR status = 'under_review'`);
    openDisputesCount = parseInt(disRes.rows[0]?.count || '0', 10);
  } catch (err) {
    rootLogger.debug('Deriving metrics from memory store for getPlatformMetrics', {
      error: (err as Error).message,
    });
    // Derive from memory
    const txs = await listTransactions({ limit: 1000 });
    totalTransactions = txs.length;
    totalVolume = txs.reduce((sum, t) => sum + (t.amount || 0), 0);
    openDisputesCount = Array.from(inMemoryDisputes.values()).filter((d) => d.status === 'open').length;
  }

  const railsWithHealth = await listRailsWithHealth();
  const railsHealth: RailHealthIndicator[] = railsWithHealth.map((r) => r.health);

  return {
    total_volume: totalVolume,
    total_transactions: totalTransactions,
    reconciliation_rate: reconciliationRate,
    exception_rate: exceptionRate,
    ai_suggestion_acceptance_rate: aiAcceptanceRate,
    total_users: totalUsers,
    pending_kyc_count: pendingKycCount,
    open_exceptions_count: openExceptionsCount,
    open_disputes_count: openDisputesCount,
    rails_health: railsHealth,
  };
}
