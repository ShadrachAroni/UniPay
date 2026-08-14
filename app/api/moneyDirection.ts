import { MoneyDirectionRule } from './types';

const MOCK_RULES: MoneyDirectionRule[] = [
  {
    id: 'rule_1',
    profile_id: 'prof_123',
    destination_type: 'bank',
    allocation_type: 'percentage',
    allocation_value: 80,
    priority_order: 1,
    is_active: true,
  },
  {
    id: 'rule_2',
    profile_id: 'prof_123',
    destination_type: 'mobile_money',
    allocation_type: 'percentage',
    allocation_value: 20,
    priority_order: 2,
    is_active: true,
  },
];

export async function getMoneyDirectionRules(): Promise<MoneyDirectionRule[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_RULES), 500);
  });
}

export async function updateMoneyDirectionRule(
  id: string,
  updates: Partial<MoneyDirectionRule>,
): Promise<MoneyDirectionRule> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const rule = MOCK_RULES.find((r) => r.id === id) || MOCK_RULES[0];
      resolve({ ...rule, ...updates });
    }, 600);
  });
}
