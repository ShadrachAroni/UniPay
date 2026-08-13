-- UniPay Baseline Migration 0001
-- Establishes the migrations tracking table and proves database connectivity.
-- Rule (Handbook M8.3): Every subsequent column addition must be optional with a default.

CREATE TABLE IF NOT EXISTS _unipay_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Register baseline migration
INSERT INTO _unipay_migrations (name)
VALUES ('0001_init')
ON CONFLICT (name) DO NOTHING;
