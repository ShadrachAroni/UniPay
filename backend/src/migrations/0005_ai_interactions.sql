-- UniPay Backend Migration 0005: AI Interactions Table
-- Authoritative Schema Reference: UniPay_Schema_Documentation.md §3.34 & Technical Documentation §11, §15, §19

CREATE TABLE IF NOT EXISTS ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  interaction_type text NOT NULL CHECK (interaction_type IN ('query', 'support', 'reconciliation', 'document_check', 'fraud_flag')),
  input_summary text NOT NULL,
  output_summary text NOT NULL,
  confidence_score numeric(3,2) DEFAULT NULL,
  reviewed_by_human boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_profile ON ai_interactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_type ON ai_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created ON ai_interactions(created_at);

-- Register migration
INSERT INTO _unipay_migrations (name)
VALUES ('0005_ai_interactions')
ON CONFLICT (name) DO NOTHING;
