-- UniPay Backend Migration 0003: Money Direction & Payouts Tables
-- Authoritative Schema Reference: UniPay_Schema_Documentation.md §3 & §4

CREATE TABLE IF NOT EXISTS money_direction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  destination_type text NOT NULL CHECK (destination_type IN ('loop_number', 'unipay_balance', 'bank')),
  destination_reference text NOT NULL,
  allocation_type text NOT NULL CHECK (allocation_type IN ('full', 'percentage', 'fixed_amount')),
  allocation_value numeric(14,2) NOT NULL CHECK (allocation_value > 0),
  priority_order int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_money_direction_rules_profile ON money_direction_rules(profile_id, is_active, priority_order);

CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  provider text NOT NULL,
  requested_amount numeric(14,2) NOT NULL CHECK (requested_amount > 0),
  requested_currency text NOT NULL DEFAULT 'KES',
  destination_type text NOT NULL CHECK (destination_type IN ('loop_number', 'unipay_balance', 'bank')),
  destination_reference text NOT NULL,
  fee numeric(14,2) NOT NULL DEFAULT 0.00,
  net_amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  provider_reference text DEFAULT NULL,
  settlement_id uuid DEFAULT NULL,
  rule_id uuid DEFAULT NULL,
  rule_snapshot jsonb DEFAULT NULL,
  is_manual_withdrawal boolean NOT NULL DEFAULT false,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz DEFAULT NULL,
  raw_payload jsonb DEFAULT NULL,
  idempotency_key text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payouts_profile ON payouts(profile_id, status);

-- Register migration
INSERT INTO _unipay_migrations (name)
VALUES ('0003_money_direction_payouts')
ON CONFLICT (name) DO NOTHING;
