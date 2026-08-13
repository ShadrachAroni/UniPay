-- Supabase / PostgreSQL Migration: 003_create_ai_interactions.sql
-- UniPay AI Interactions Audit Table (§11, §15, §19)

CREATE TABLE IF NOT EXISTS ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
