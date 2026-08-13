-- UniPay Phase 4 Migration: reconciliation_matches and reconciliation_exceptions Tables DDL
-- Authoritative Schema Reference: UniPay_Schema_Documentation.md §3 & §4

CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  transaction_id uuid NOT NULL UNIQUE,
  match_source text NOT NULL DEFAULT 'order' CHECK (match_source IN ('order', 'expected_payment', 'pool_contribution')),
  expected_payment_id uuid DEFAULT NULL,
  pool_contribution_id uuid DEFAULT NULL,
  expected_reference text DEFAULT NULL,
  expected_amount numeric(14,2) NOT NULL,
  matched_amount numeric(14,2) NOT NULL,
  match_type text NOT NULL CHECK (match_type IN ('exact_reference', 'exact_amount_window', 'payer_amount', 'ai_fuzzy', 'manual')),
  confidence_score numeric(3,2) NOT NULL CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
  ai_explanation text DEFAULT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'rejected')),
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_single_match_source_fk CHECK (
    (match_source = 'order' AND expected_payment_id IS NULL AND pool_contribution_id IS NULL) OR
    (match_source = 'expected_payment' AND expected_payment_id IS NOT NULL AND pool_contribution_id IS NULL) OR
    (match_source = 'pool_contribution' AND expected_payment_id IS NULL AND pool_contribution_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_tx ON reconciliation_matches(transaction_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_profile ON reconciliation_matches(profile_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_exp_pay ON reconciliation_matches(expected_payment_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_pool_contrib ON reconciliation_matches(pool_contribution_id);

CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  transaction_id uuid DEFAULT NULL,
  category text NOT NULL CHECK (category IN (
    'missing_provider_transaction',
    'missing_order',
    'amount_mismatch',
    'duplicate_payment',
    'fee_mismatch',
    'settlement_delay',
    'unknown_provider_reference',
    'overpayment'
  )),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_exceptions_profile ON reconciliation_exceptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_exceptions_tx ON reconciliation_exceptions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_exceptions_category ON reconciliation_exceptions(category, status);
