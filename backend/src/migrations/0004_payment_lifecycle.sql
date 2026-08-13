-- UniPay Migration 0004 — Phase 3: LOOP Integration & Payment Lifecycle
-- Creates payment_intents, transactions, settlements, webhook_events, outbox_events tables
-- and seeds the real 'loop' payment rail row (§11, §12, §13, Handbook M2)

-- 1. Payment Intents Table
CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    order_reference TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    payer_phone TEXT,
    payer_email TEXT,
    provider TEXT NOT NULL,
    rail TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'completed', 'expired', 'failed')),
    provider_reference TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique index on idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency_key ON payment_intents (idempotency_key);
-- Lookup index on recipient_profile_id and status
CREATE INDEX IF NOT EXISTS idx_payment_intents_recipient_status ON payment_intents (recipient_profile_id, status);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL,
    rail TEXT NOT NULL,
    internal_reference TEXT NOT NULL UNIQUE,
    external_reference TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    provider_fee NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(14,2) NOT NULL,
    payer_identifier TEXT,
    payment_status TEXT NOT NULL DEFAULT 'initiated' CHECK (payment_status IN ('initiated', 'successful', 'failed', 'reversed')),
    settlement_status TEXT NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled', 'delayed')),
    refund_status TEXT NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'partial', 'full')),
    transaction_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMPTZ,
    ai_category TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Composite index on recipient_profile_id and payment_status (Handbook M1 indexing discipline)
CREATE INDEX IF NOT EXISTS idx_transactions_profile_status ON transactions (recipient_profile_id, payment_status);
-- BTree index on settled_at for batch reconciliation jobs
CREATE INDEX IF NOT EXISTS idx_transactions_settled_at ON transactions (settled_at);
-- Index on external_reference for lookup/reconciliation matching
CREATE INDEX IF NOT EXISTS idx_transactions_external_ref ON transactions (external_reference);

-- 3. Settlements Table
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL,
    settlement_reference TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    gross_amount NUMERIC(14,2) NOT NULL,
    fees NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(14,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'failed')),
    expected_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlements_profile_status ON settlements (profile_id, status);

-- 4. Webhook Events Table (Deduplication & Idempotent Consumer — Handbook M2)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events (event_id);

-- 5. Outbox Events Table (Outbox Pattern — Handbook M2)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events (status);

-- 6. Enable the real 'loop' row in payment_rails (Task 5)
INSERT INTO payment_rails (
    id,
    name,
    adapter_key,
    is_enabled,
    supported_currencies,
    supported_countries,
    min_amount,
    max_amount,
    capabilities_json
) VALUES (
    'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
    'LOOP Mobile Money (NCBA)',
    'loop',
    TRUE,
    ARRAY['KES'],
    ARRAY['KE'],
    10.00,
    500000.00,
    '{
        "collection": true,
        "statusInquiry": true,
        "refund": false,
        "disbursement": true,
        "webhooks": true,
        "supportedCurrencies": ["KES"],
        "supportedCountries": ["KE"],
        "settlementEstimate": "instant",
        "feeStructure": {
            "fixed": 0,
            "percentage": 0.015
        }
    }'::jsonb
) ON CONFLICT (adapter_key) DO UPDATE SET
    name = EXCLUDED.name,
    is_enabled = EXCLUDED.is_enabled,
    supported_currencies = EXCLUDED.supported_currencies,
    supported_countries = EXCLUDED.supported_countries,
    min_amount = EXCLUDED.min_amount,
    max_amount = EXCLUDED.max_amount,
    capabilities_json = EXCLUDED.capabilities_json,
    updated_at = CURRENT_TIMESTAMP;
