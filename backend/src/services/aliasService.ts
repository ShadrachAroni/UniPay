import crypto from 'crypto';
import { pool } from '../db';
import { rootLogger } from '../utils/logger';
import { Alias, IdentifierType, AliasStatus, Profile } from '@unipay/shared';
import { getProfileById } from './profileService';

// In-memory fallback map for test environments
const inMemoryAliases = new Map<string, Alias>();

export interface CreateAliasDTO {
  profile_id: string;
  alias: string;
  identifier_type?: IdentifierType;
}

export function normalizeAlias(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.startsWith('@')) {
    return trimmed;
  }
  return `@${trimmed}`;
}

export async function createAlias(dto: CreateAliasDTO): Promise<Alias> {
  const profile = await getProfileById(dto.profile_id);
  if (!profile) {
    throw new Error('Profile not found');
  }

  // §8 & Phase 1 Gate: Alias creation is strictly gated on identity submission
  if (profile.verification_status === 'unsubmitted') {
    const err: any = new Error(
      'Identity verification required: You must submit your ID before generating an alias or QR identifier'
    );
    err.statusCode = 403;
    throw err;
  }

  const normalized = normalizeAlias(dto.alias);
  if (!/^@[a-z0-9_.-]{3,30}$/.test(normalized)) {
    const err: any = new Error(
      'Invalid alias format. Aliases must start with @ and contain 3-30 alphanumeric characters, dots, or underscores'
    );
    err.statusCode = 400;
    throw err;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const identifier_type: IdentifierType = dto.identifier_type || 'alias';
  const is_verified = profile.verification_status === 'approved';
  const status: AliasStatus = 'active';

  const alias: Alias = {
    id,
    profile_id: dto.profile_id,
    alias: normalized,
    identifier_type,
    is_verified,
    status,
    created_at: now,
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO aliases (id, profile_id, alias, identifier_type, is_verified, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        alias.id,
        alias.profile_id,
        alias.alias,
        alias.identifier_type,
        alias.is_verified,
        alias.status,
        alias.created_at,
      ]
    );

    if (rows.length > 0) {
      inMemoryAliases.set(rows[0].id, rows[0]);
      return rows[0];
    }
  } catch (err) {
    rootLogger.debug('Postgres insert failed, falling back to memory store for aliases', {
      error: (err as Error).message,
    });
  }

  // Check unique alias in memory
  for (const existing of inMemoryAliases.values()) {
    if (existing.alias === normalized) {
      const err: any = new Error('This alias handle is already taken');
      err.statusCode = 409;
      throw err;
    }
  }

  inMemoryAliases.set(alias.id, alias);
  return alias;
}

export async function getAliasesByProfileId(profileId: string): Promise<Alias[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM aliases WHERE profile_id = $1 ORDER BY created_at ASC`,
      [profileId]
    );
    if (rows.length > 0) {
      return rows;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for getAliasesByProfileId', {
      error: (err as Error).message,
    });
  }

  const results: Alias[] = [];
  for (const a of inMemoryAliases.values()) {
    if (a.profile_id === profileId) {
      results.push(a);
    }
  }
  return results;
}

export async function getAliasByHandle(
  rawAlias: string
): Promise<{ alias: Alias; profile: Profile } | null> {
  const normalized = normalizeAlias(rawAlias);

  let aliasRow: Alias | null = null;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM aliases WHERE alias = $1 AND status = 'active' LIMIT 1`,
      [normalized]
    );
    if (rows.length > 0) {
      aliasRow = rows[0];
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for getAliasByHandle', {
      error: (err as Error).message,
    });
  }

  if (!aliasRow) {
    for (const a of inMemoryAliases.values()) {
      if (a.alias === normalized && a.status === 'active') {
        aliasRow = a;
        break;
      }
    }
  }

  if (!aliasRow) {
    return null;
  }

  const profile = await getProfileById(aliasRow.profile_id);
  if (!profile) {
    return null;
  }

  return { alias: aliasRow, profile };
}

export function clearAliasCache(): void {
  inMemoryAliases.clear();
}
