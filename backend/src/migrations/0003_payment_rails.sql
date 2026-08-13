-- UniPay Migration 0003 — Phase 2: Provider Adapter Architecture & Payment Rails
-- Config-driven rail/currency availability and provider capabilities table (§11)

-- 1. Payment Rails Table
CREATE TABLE IF NOT EXISTS payment_rails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    adapter_key TEXT NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    supported_currencies TEXT[] NOT NULL DEFAULT '{"KES"}',
    supported_countries TEXT[] NOT NULL DEFAULT '{"KE"}',
    min_amount NUMERIC(14,2) NOT NULL DEFAULT 10.00,
    max_amount NUMERIC(14,2) NOT NULL DEFAULT 1000000.00,
    capabilities_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique index on adapter_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_rails_adapter_key ON payment_rails (adapter_key);

-- BTree index on is_enabled for active rail lookups
CREATE INDEX IF NOT EXISTS idx_payment_rails_is_enabled ON payment_rails (is_enabled);

-- Seed initial row for seeded fixture adapter (Task 3)
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
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'Seeded Rail (Simulated Fixture)',
    'seeded',
    TRUE,
    ARRAY['KES'],
    ARRAY['KE'],
    10.00,
    500000.00,
    '{
        "collection": true,
        "statusInquiry": true,
        "refund": true,
        "disbursement": true,
        "webhooks": true,
        "supportedCurrencies": ["KES"],
        "supportedCountries": ["KE"],
        "settlementEstimate": "instant",
        "feeStructure": {
            "fixed": 0,
            "percentage": 0.005
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
