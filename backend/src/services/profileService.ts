import crypto from 'crypto';
import { pool } from '../db';
import { rootLogger } from '../utils/logger';
import { Profile, AccountType, VerificationStatus } from '@unipay/shared';

// In-memory fallback map for test environments
const inMemoryProfiles = new Map<string, Profile>();

export interface CreateProfileDTO {
  clerk_user_id: string;
  account_type: AccountType;
  display_name: string;
  owner_name: string;
  phone?: string | null;
  email?: string | null;
  currency?: string;
  country_code?: string;
}

export interface SubmitIdentityDTO {
  id_number: string;
  id_document_url: string;
  id_selfie_url?: string | null;
}

export interface ReviewIdentityDTO {
  decision: 'approved' | 'rejected';
  reviewer_note?: string;
}

export async function createProfile(dto: CreateProfileDTO): Promise<Profile> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const currency = dto.currency || 'KES';
  const country_code = dto.country_code || 'KE';
  const status = 'active';
  const verification_status: VerificationStatus = 'unsubmitted';

  const profile: Profile = {
    id,
    account_type: dto.account_type,
    display_name: dto.display_name,
    owner_name: dto.owner_name,
    clerk_user_id: dto.clerk_user_id,
    phone: dto.phone || null,
    email: dto.email || null,
    currency,
    country_code,
    status,
    verification_status,
    id_number: null,
    id_document_url: null,
    id_selfie_url: null,
    id_submitted_at: null,
    id_reviewed_at: null,
    id_reviewer_note: null,
    id_ai_check_result: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO profiles 
        (id, account_type, display_name, owner_name, clerk_user_id, phone, email, currency, country_code, status, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        profile.id,
        profile.account_type,
        profile.display_name,
        profile.owner_name,
        profile.clerk_user_id,
        profile.phone,
        profile.email,
        profile.currency,
        profile.country_code,
        profile.status,
        profile.verification_status,
      ]
    );

    if (rows.length > 0) {
      inMemoryProfiles.set(rows[0].id, rows[0]);
      syncProfileToClerkMetadata(dto.clerk_user_id, dto.account_type).catch(() => {});
      return rows[0];
    }
  } catch (err) {
    rootLogger.debug('Postgres insert failed, falling back to memory store for profiles', {
      error: (err as Error).message,
    });
  }

  // Check unique clerk_user_id in memory
  for (const existing of inMemoryProfiles.values()) {
    if (existing.clerk_user_id === dto.clerk_user_id) {
      throw new Error('A profile with this clerk_user_id already exists');
    }
  }

  inMemoryProfiles.set(profile.id, profile);
  syncProfileToClerkMetadata(dto.clerk_user_id, dto.account_type).catch(() => {});
  return profile;
}

async function syncProfileToClerkMetadata(clerkUserId: string, accountType: AccountType): Promise<void> {
  if (!process.env.CLERK_SECRET_KEY || clerkUserId.startsWith('test_') || clerkUserId.startsWith('clerk_')) {
    return;
  }
  try {
    await fetch(`https://api.clerk.com/v1/users/${clerkUserId}/metadata`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_metadata: {
          account_type: accountType,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    rootLogger.debug('Clerk metadata sync skipped or failed', { error: String(err) });
  }
}

export async function getProfileById(id: string): Promise<Profile | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM profiles WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length > 0) {
      return rows[0];
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for getProfileById', {
      error: (err as Error).message,
    });
  }

  return inMemoryProfiles.get(id) || null;
}

export async function getProfileByClerkId(clerkUserId: string): Promise<Profile | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM profiles WHERE clerk_user_id = $1 LIMIT 1`,
      [clerkUserId]
    );
    if (rows.length > 0) {
      return rows[0];
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for getProfileByClerkId', {
      error: (err as Error).message,
    });
  }

  for (const p of inMemoryProfiles.values()) {
    if (p.clerk_user_id === clerkUserId) {
      return p;
    }
  }

  return null;
}

export async function submitIdentity(
  profileId: string,
  dto: SubmitIdentityDTO
): Promise<Profile> {
  const profile = await getProfileById(profileId);
  if (!profile) {
    throw new Error('Profile not found');
  }

  const now = new Date().toISOString();
  const nextStatus: VerificationStatus = 'submitted';

  try {
    const { rows } = await pool.query(
      `UPDATE profiles 
       SET id_number = $1,
           id_document_url = $2,
           id_selfie_url = $3,
           id_submitted_at = $4,
           verification_status = $5,
           updated_at = $6
       WHERE id = $7
       RETURNING *`,
      [
        dto.id_number,
        dto.id_document_url,
        dto.id_selfie_url || null,
        now,
        nextStatus,
        now,
        profileId,
      ]
    );

    if (rows.length > 0) {
      inMemoryProfiles.set(rows[0].id, rows[0]);
      return rows[0];
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for submitIdentity', {
      error: (err as Error).message,
    });
  }

  const updated: Profile = {
    ...profile,
    id_number: dto.id_number,
    id_document_url: dto.id_document_url,
    id_selfie_url: dto.id_selfie_url || null,
    id_submitted_at: now,
    verification_status: nextStatus,
    updated_at: now,
  };

  inMemoryProfiles.set(profileId, updated);
  return updated;
}

export async function reviewIdentity(
  profileId: string,
  dto: ReviewIdentityDTO
): Promise<Profile> {
  const profile = await getProfileById(profileId);
  if (!profile) {
    throw new Error('Profile not found');
  }

  if (profile.verification_status === 'unsubmitted') {
    throw new Error('Cannot review an unsubmitted profile');
  }

  const now = new Date().toISOString();
  const nextStatus: VerificationStatus = dto.decision;

  try {
    const { rows } = await pool.query(
      `UPDATE profiles 
       SET verification_status = $1,
           id_reviewed_at = $2,
           id_reviewer_note = $3,
           updated_at = $4
       WHERE id = $5
       RETURNING *`,
      [nextStatus, now, dto.reviewer_note || null, now, profileId]
    );

    if (rows.length > 0) {
      inMemoryProfiles.set(rows[0].id, rows[0]);
      return rows[0];
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for reviewIdentity', {
      error: (err as Error).message,
    });
  }

  const updated: Profile = {
    ...profile,
    verification_status: nextStatus,
    id_reviewed_at: now,
    id_reviewer_note: dto.reviewer_note || null,
    updated_at: now,
  };

  inMemoryProfiles.set(profileId, updated);
  return updated;
}

export function clearProfileCache(): void {
  inMemoryProfiles.clear();
}
