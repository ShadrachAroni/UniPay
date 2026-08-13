import { MoneyDirectionRule } from '../types/money-direction.types.js';

export class MoneyDirectionRulesRepository {
  private rules: Map<string, MoneyDirectionRule> = new Map();

  async save(rule: MoneyDirectionRule): Promise<MoneyDirectionRule> {
    const saved = { ...rule, updatedAt: new Date() };
    this.rules.set(rule.id, saved);
    return { ...saved };
  }

  async findById(id: string): Promise<MoneyDirectionRule | null> {
    const rule = this.rules.get(id);
    return rule ? { ...rule } : null;
  }

  async findByProfileId(profileId: string): Promise<MoneyDirectionRule[]> {
    return Array.from(this.rules.values())
      .filter((r) => r.profileId === profileId)
      .sort((a, b) => a.priorityOrder - b.priorityOrder);
  }

  async findActiveByProfileId(profileId: string): Promise<MoneyDirectionRule[]> {
    return Array.from(this.rules.values())
      .filter((r) => r.profileId === profileId && r.isActive)
      .sort((a, b) => a.priorityOrder - b.priorityOrder);
  }

  async delete(id: string): Promise<boolean> {
    return this.rules.delete(id);
  }

  async clear(): Promise<void> {
    this.rules.clear();
  }
}
