-- UniPay Migration 0006 — Phase 5: Money Direction (User-Controlled Payout Routing)
-- Creates money_direction_rules table (§11, §17)

CREATE TABLE IF NOT EXISTS money_direction_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    destination_type TEXT NOT NULL,
    destination_reference TEXT,
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('full', 'percentage', 'fixed_amount')),
    allocation_value NUMERIC(14,2),
    priority_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index on profile_id, is_active, priority_order for efficient settlement evaluation queries
CREATE INDEX IF NOT EXISTS idx_money_direction_profile_active ON money_direction_rules (profile_id, is_active, priority_order);
