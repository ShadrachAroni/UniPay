-- UniPay Migration 0007 — Phase 6: Disbursement & Payout Orchestration
-- Creates payouts table (§11, §12, §18)

CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL,
    requested_amount NUMERIC(14,2) NOT NULL,
    requested_currency TEXT NOT NULL DEFAULT 'KES',
    destination_type TEXT NOT NULL,
    destination_reference TEXT,
    fee NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(14,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
    provider_reference TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    raw_payload JSONB,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique index on idempotency_key (§11)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_idempotency_key ON payouts (idempotency_key);
-- Composite lookup index on profile_id and status for balance calculations and listing (§11)
CREATE INDEX IF NOT EXISTS idx_payouts_profile_status ON payouts (profile_id, status);
-- Index on requested_at for sorting and reporting
CREATE INDEX IF NOT EXISTS idx_payouts_requested_at ON payouts (requested_at);
