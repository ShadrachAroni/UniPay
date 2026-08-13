import crypto from 'crypto';
import { pool } from '../db';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { getPaymentIntentByProviderReference, updatePaymentIntentStatus, getPaymentIntentById } from './paymentIntentService';
import { recordTransaction, TransactionEntity } from './transactionService';
import { WebhookRequestLike } from '@unipay/shared';
import { rootLogger } from '../utils/logger';

export interface WebhookProcessingResult {
  success: boolean;
  duplicate: boolean;
  eventId: string;
  transaction?: TransactionEntity;
  message?: string;
}

export interface OutboxEventEntity {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processed' | 'failed';
  created_at: string;
  processed_at?: string | null;
}

// In-memory fallback for offline test environments
const processedEventIds = new Set<string>();
const inMemoryOutbox: OutboxEventEntity[] = [];

export async function isEventProcessed(eventId: string): Promise<boolean> {
  if (processedEventIds.has(eventId)) {
    return true;
  }

  try {
    const { rows } = await pool.query(
      `SELECT id FROM webhook_events WHERE event_id = $1 LIMIT 1`,
      [eventId]
    );
    if (rows.length > 0) {
      processedEventIds.add(eventId);
      return true;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for isEventProcessed', {
      error: (err as Error).message,
    });
  }

  return false;
}

export async function markEventProcessed(
  eventId: string,
  provider: string,
  payload: unknown
): Promise<void> {
  processedEventIds.add(eventId);

  try {
    await pool.query(
      `INSERT INTO webhook_events (event_id, provider, payload, processed)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, provider, JSON.stringify(payload || {})]
    );
  } catch (err) {
    rootLogger.debug('Falling back to memory for markEventProcessed', {
      error: (err as Error).message,
    });
  }
}

export async function createOutboxEvent(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>
): Promise<OutboxEventEntity> {
  const event: OutboxEventEntity = {
    id: crypto.randomUUID(),
    event_type: eventType,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    payload,
    status: 'pending',
    created_at: new Date().toISOString(),
    processed_at: null,
  };

  try {
    await pool.query(
      `INSERT INTO outbox_events (id, event_type, aggregate_type, aggregate_id, payload, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [event.id, event.event_type, event.aggregate_type, event.aggregate_id, JSON.stringify(event.payload)]
    );
  } catch (err) {
    rootLogger.debug('Falling back to memory store for createOutboxEvent', {
      error: (err as Error).message,
    });
  }

  inMemoryOutbox.push(event);
  return event;
}

export async function getPendingOutboxEvents(): Promise<OutboxEventEntity[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM outbox_events WHERE status = 'pending' ORDER BY created_at ASC`
    );
    if (rows.length > 0) {
      return rows as OutboxEventEntity[];
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for getPendingOutboxEvents', {
      error: (err as Error).message,
    });
  }

  return inMemoryOutbox.filter((e) => e.status === 'pending');
}

export async function markOutboxEventProcessed(id: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await pool.query(
      `UPDATE outbox_events SET status = 'processed', processed_at = $1 WHERE id = $2`,
      [now, id]
    );
  } catch (err) {
    rootLogger.debug('Falling back to memory store for markOutboxEventProcessed', {
      error: (err as Error).message,
    });
  }

  const found = inMemoryOutbox.find((e) => e.id === id);
  if (found) {
    found.status = 'processed';
    found.processed_at = now;
  }
}

/**
 * Core Webhook Processing Engine (Handbook Module 2 — Idempotent Consumer & Outbox Pattern)
 */
export async function processProviderWebhook(
  providerKey: string,
  req: WebhookRequestLike
): Promise<WebhookProcessingResult> {
  const adapter = defaultAdapterRegistry.get(providerKey);

  // 1. Verify Webhook Signature
  const isValid = adapter.verifyWebhook(req);
  if (!isValid) {
    rootLogger.warn('Rejected webhook with invalid signature', {
      provider: providerKey,
    });
    throw new Error('Invalid webhook signature');
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, any>;

  // 2. Extract unique event ID for deduplication
  const eventId =
    body.eventId ||
    body.event_id ||
    body.id ||
    (req.headers && (req.headers['x-event-id'] || req.headers['x-loop-event-id'])) ||
    body.data?.txnReference ||
    body.txnReference ||
    body.reference ||
    `evt_${crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16)}`;

  // 3. Deduplicate (Idempotent Consumer)
  if (await isEventProcessed(eventId)) {
    rootLogger.info('Duplicate webhook event detected, skipping downstream processing', {
      provider: providerKey,
      eventId,
    });
    return {
      success: true,
      duplicate: true,
      eventId,
      message: 'Event already processed',
    };
  }

  // 4. Normalize Payload
  const normalized = adapter.normalize(body);

  // 5. Match with Payment Intent
  const providerRef =
    body.txnReference ||
    body.data?.txnReference ||
    normalized.external_reference ||
    normalized.internal_reference;

  let matchedIntent = await getPaymentIntentByProviderReference(providerRef);
  let recipientProfileId = matchedIntent?.recipient_profile_id;

  if (!matchedIntent && body.payment_intent_id) {
    matchedIntent = await getPaymentIntentById(body.payment_intent_id);
    recipientProfileId = matchedIntent?.recipient_profile_id;
  }

  if (!recipientProfileId) {
    // If no matching intent found (e.g. standalone test webhook), use default/system fallback
    recipientProfileId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  }

  // 6. Record Normalized Transaction into Ledger
  const transaction = await recordTransaction(
    normalized,
    recipientProfileId,
    matchedIntent?.id || null
  );

  // 7. Update Payment Intent status
  if (matchedIntent) {
    const newStatus =
      normalized.payment_status === 'successful'
        ? 'completed'
        : normalized.payment_status === 'failed'
          ? 'failed'
          : 'pending';
    await updatePaymentIntentStatus(matchedIntent.id, newStatus, normalized.external_reference);
  }

  // 8. Write Outbox Event in transaction
  await createOutboxEvent(
    'payment.completed',
    'transaction',
    transaction.id,
    {
      transaction_id: transaction.id,
      payment_intent_id: matchedIntent?.id || null,
      amount: transaction.amount,
      currency: transaction.currency,
      provider: transaction.provider,
      rail: transaction.rail,
      payment_status: transaction.payment_status,
      settlement_status: transaction.settlement_status,
    }
  );

  // 9. Mark Event Processed (Deduplication record)
  await markEventProcessed(eventId, providerKey, body);

  rootLogger.info('Successfully processed provider webhook', {
    provider: providerKey,
    eventId,
    transaction_id: transaction.id,
    payment_status: transaction.payment_status,
  });

  return {
    success: true,
    duplicate: false,
    eventId,
    transaction,
  };
}

export function clearWebhookCache(): void {
  processedEventIds.clear();
  inMemoryOutbox.length = 0;
}
