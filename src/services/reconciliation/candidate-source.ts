import { NormalizedTransaction } from '../../types/payment-provider.js';
import { CandidateSource, ReconciliationCandidate } from '../../types/reconciliation.types.js';

export class OrderCandidateSource implements CandidateSource {
  priority = 30; // Phase 4 priority (leaves 10 & 20 open for Phase 4B sources)

  private candidates: ReconciliationCandidate[] = [];

  constructor(initialCandidates: ReconciliationCandidate[] = []) {
    this.candidates = [...initialCandidates];
  }

  addCandidate(candidate: ReconciliationCandidate): void {
    this.candidates.push(candidate);
  }

  async fetch(transactions: NormalizedTransaction[]): Promise<Map<string, ReconciliationCandidate[]>> {
    // Batched candidate fetch for all given transactions
    const map = new Map<string, ReconciliationCandidate[]>();
    const profileIds = new Set(transactions.map((tx) => (tx as any).recipientProfileId || (tx as any).profileId));

    for (const tx of transactions) {
      const txId = (tx as any).id || tx.internalReference;
      const txProfileId = (tx as any).recipientProfileId || (tx as any).profileId;
      
      // Match candidate by profile and reference or eligible candidates
      const matchingCandidates = this.candidates.filter(
        (c) => c.profileId === txProfileId || !c.profileId
      );

      map.set(txId, matchingCandidates);
    }

    return map;
  }
}

export class CandidateSourceRegistry {
  private sources: CandidateSource[] = [];

  register(source: CandidateSource): void {
    this.sources.push(source);
    // Maintain priority order: lower priority number runs first
    this.sources.sort((a, b) => a.priority - b.priority);
  }

  getSources(): CandidateSource[] {
    return [...this.sources];
  }

  async fetchAllCandidates(
    transactions: NormalizedTransaction[]
  ): Promise<Map<string, ReconciliationCandidate[]>> {
    const combinedMap = new Map<string, ReconciliationCandidate[]>();

    for (const tx of transactions) {
      const txId = (tx as any).id || tx.internalReference;
      combinedMap.set(txId, []);
    }

    // Fetch from each registered source in priority order
    for (const source of this.sources) {
      const sourceMap = await source.fetch(transactions);
      for (const [txId, candidates] of sourceMap.entries()) {
        const existing = combinedMap.get(txId) || [];
        combinedMap.set(txId, [...existing, ...candidates]);
      }
    }

    return combinedMap;
  }
}
