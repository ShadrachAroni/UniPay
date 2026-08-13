-- UniPay Phase 2 Migration: payment_rails Table DDL
-- Authoritative Schema Reference: UniPay_Schema_Documentation.md §3

CREATE TABLE IF NOT EXISTS payment_rails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  adapter_key text UNIQUE NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  supported_currencies text[] NOT NULL DEFAULT '{KES}',
  supported_countries text[] NOT NULL DEFAULT '{KE}',
  min_amount numeric(14,2) NOT NULL DEFAULT 1.00,
  max_amount numeric(14,2) NOT NULL DEFAULT 500000.00,
  capabilities_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default rails configuration
INSERT INTO payment_rails (id, name, adapter_key, is_enabled, supported_currencies, supported_countries, min_amount, max_amount, capabilities_json)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',
    'Seeded Payment Rail (Simulated)',
    'seeded',
    true,
    '{KES}',
    '{KE}',
    1.00,
    500000.00,
    '{"collection": true, "statusInquiry": true, "refund": true, "disbursement": true, "webhooks": true, "supportedCurrencies": ["KES"], "supportedCountries": ["KE"]}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'LOOP Mobile Money',
    'loop',
    true,
    '{KES}',
    '{KE}',
    1.00,
    250000.00,
    '{"collection": true, "statusInquiry": true, "refund": false, "disbursement": true, "webhooks": true, "supportedCurrencies": ["KES"], "supportedCountries": ["KE"]}'::jsonb
  )
ON CONFLICT (adapter_key) DO UPDATE SET
  name = EXCLUDED.name,
  is_enabled = EXCLUDED.is_enabled,
  supported_currencies = EXCLUDED.supported_currencies,
  supported_countries = EXCLUDED.supported_countries,
  min_amount = EXCLUDED.min_amount,
  max_amount = EXCLUDED.max_amount,
  capabilities_json = EXCLUDED.capabilities_json,
  updated_at = now();
