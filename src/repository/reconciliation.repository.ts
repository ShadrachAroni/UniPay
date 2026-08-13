import {
  ReconciliationMatch,
  ReconciliationException,
  ExceptionCategory,
} from '../types/reconciliation.types.js';

export class ReconciliationRepository {
  private matches: Map<string, ReconciliationMatch> = new Map(); // transactionId -> ReconciliationMatch
  private exceptions: Map<string, ReconciliationException> = new Map(); // id -> ReconciliationException
  private queryCount: number = 0;

  resetQueryCount(): void {
    this.queryCount = 0;
  }

  getQueryCount(): number {
    return this.queryCount;
  }

  async saveMatch(match: ReconciliationMatch): Promise<ReconciliationMatch> {
    this.queryCount++;
    // Idempotent upsert by transactionId
    const existing = this.matches.get(match.transactionId);
    if (existing) {
      const updated: ReconciliationMatch = {
        ...existing,
        ...match,
        updatedAt: new Date(),
      };
      this.matches.set(match.transactionId, updated);
      return { ...updated };
    }

    const newMatch = { ...match, updatedAt: new Date() };
    this.matches.set(match.transactionId, newMatch);
    return { ...newMatch };
  }

  async saveMatchesBatch(matches: ReconciliationMatch[]): Promise<ReconciliationMatch[]> {
    if (matches.length === 0) return [];
    this.queryCount++; // Single batched query write operation
    const saved: ReconciliationMatch[] = [];
    for (const match of matches) {
      const existing = this.matches.get(match.transactionId);
      const toSave = existing
        ? { ...existing, ...match, updatedAt: new Date() }
        : { ...match, updatedAt: new Date() };
      this.matches.set(match.transactionId, toSave);
      saved.push({ ...toSave });
    }
    return saved;
  }

  async saveException(exception: ReconciliationException): Promise<ReconciliationException> {
    this.queryCount++;
    // Check if duplicate exception exists for transaction_id and category
    if (exception.transactionId) {
      for (const existing of this.exceptions.values()) {
        if (
          existing.transactionId === exception.transactionId &&
          existing.category === exception.category
        ) {
          return { ...existing }; // Return existing exception idempotently
        }
      }
    }

    this.exceptions.set(exception.id, { ...exception });
    return { ...exception };
  }

  async saveExceptionsBatch(exceptions: ReconciliationException[]): Promise<ReconciliationException[]> {
    if (exceptions.length === 0) return [];
    this.queryCount++; // Single batched query write operation
    const saved: ReconciliationException[] = [];
    for (const ex of exceptions) {
      let duplicateFound = false;
      if (ex.transactionId) {
        for (const existing of this.exceptions.values()) {
          if (
            existing.transactionId === ex.transactionId &&
            existing.category === ex.category
          ) {
            saved.push({ ...existing });
            duplicateFound = true;
            break;
          }
        }
      }
      if (!duplicateFound) {
        this.exceptions.set(ex.id, { ...ex });
        saved.push({ ...ex });
      }
    }
    return saved;
  }

  async findMatchByTransactionId(transactionId: string): Promise<ReconciliationMatch | null> {
    this.queryCount++;
    const match = this.matches.get(transactionId);
    return match ? { ...match } : null;
  }

  async findMatchesByTransactionIdsBatch(
    transactionIds: string[]
  ): Promise<Map<string, ReconciliationMatch>> {
    this.queryCount++; // Single batched query lookup
    const result = new Map<string, ReconciliationMatch>();
    for (const id of transactionIds) {
      const match = this.matches.get(id);
      if (match) {
        result.set(id, { ...match });
      }
    }
    return result;
  }

  async findExceptionsByProfileId(profileId: string): Promise<ReconciliationException[]> {
    this.queryCount++;
    return Array.from(this.exceptions.values()).filter((e) => e.profileId === profileId);
  }

  async findAllExceptions(status?: string): Promise<ReconciliationException[]> {
    this.queryCount++;
    return Array.from(this.exceptions.values()).filter((e) => !status || e.status === status);
  }

  async findAllMatches(): Promise<ReconciliationMatch[]> {
    this.queryCount++;
    return Array.from(this.matches.values());
  }

  async clear(): Promise<void> {
    this.matches.clear();
    this.exceptions.clear();
    this.queryCount = 0;
  }
}
