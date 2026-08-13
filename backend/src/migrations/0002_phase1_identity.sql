-- UniPay Migration 0002 — Phase 1: Identity, Auth & Data Model
-- Single account model (flag, not a fork), aliases identity primitive, and idempotency tracking

-- Enable pgcrypto / uuid extension if available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'business')),
    display_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    clerk_user_id TEXT NOT NULL UNIQUE,
    phone TEXT,
    email TEXT,
    currency TEXT NOT NULL DEFAULT 'KES',
    country_code TEXT NOT NULL DEFAULT 'KE',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    verification_status TEXT NOT NULL DEFAULT 'unsubmitted' CHECK (
        verification_status IN (
            'unsubmitted',
            'submitted',
            'ai_precheck_passed',
            'ai_precheck_flagged',
            'approved',
            'rejected'
        )
    ),
    id_number TEXT,
    id_document_url TEXT,
    id_selfie_url TEXT,
    id_submitted_at TIMESTAMPTZ,
    id_reviewed_at TIMESTAMPTZ,
    id_reviewer_note TEXT,
    id_ai_check_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique index on clerk_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_clerk_user_id ON profiles (clerk_user_id);

-- BTree index on verification_status for Admin identity queue
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles (verification_status);

-- 2. Aliases Table
CREATE TABLE IF NOT EXISTS aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    alias TEXT NOT NULL UNIQUE,
    identifier_type TEXT NOT NULL DEFAULT 'alias' CHECK (identifier_type IN ('alias', 'qr', 'link')),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique index on alias
CREATE UNIQUE INDEX IF NOT EXISTS idx_aliases_alias ON aliases (alias);

-- Index on profile_id
CREATE INDEX IF NOT EXISTS idx_aliases_profile_id ON aliases (profile_id);

-- 3. Idempotency Records Table (Handbook M8.3)
CREATE TABLE IF NOT EXISTS idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    route TEXT NOT NULL,
    user_id TEXT,
    request_hash TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_records (idempotency_key);
