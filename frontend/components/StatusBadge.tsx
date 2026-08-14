import React from 'react';
import { View, Text } from 'react-native';
import { PaymentStatus, SettlementStatus, ContributionStatus } from '../api/types';

export type StatusBadgeType = 'payment' | 'settlement' | 'pool';

export interface StatusBadgeProps {
  type: StatusBadgeType;
  status: PaymentStatus | SettlementStatus | ContributionStatus | string;
}

export function StatusBadge({ type, status }: StatusBadgeProps) {
  const getBadgeStyle = () => {
    const s = String(status).toLowerCase();

    if (type === 'payment') {
      switch (s) {
        case 'completed':
        case 'succeeded':
          return { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-400', label: `Payment: ${status}` };
        case 'pending':
          return { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-700 dark:text-slate-300', label: `Payment: ${status}` };
        case 'processing':
          return { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-400', label: `Payment: ${status}` };
        case 'failed':
        case 'refunded':
        case 'cancelled':
          return { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-400', label: `Payment: ${status}` };
        default:
          return { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-700 dark:text-slate-300', label: `Payment: ${status}` };
      }
    }

    if (type === 'settlement') {
      switch (s) {
        case 'settled':
          return { bg: 'bg-green-100 dark:bg-green-950/60', text: 'text-green-700 dark:text-green-400', label: `Settlement: ${status}` };
        case 'processing':
          return { bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-700 dark:text-blue-400', label: `Settlement: ${status}` };
        case 'pending':
          return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', label: `Settlement: ${status}` };
        case 'failed':
          return { bg: 'bg-red-100 dark:bg-red-950/60', text: 'text-red-700 dark:text-red-400', label: `Settlement: ${status}` };
        default:
          return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', label: `Settlement: ${status}` };
      }
    }

    // pool status
    switch (s) {
      case 'paid':
        return { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-400', label: `Pool: ${status}` };
      case 'partially_paid':
        return { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-400', label: `Pool: ${status}` };
      case 'unpaid':
        return { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-400', label: `Pool: ${status}` };
      default:
        return { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-700 dark:text-slate-300', label: `Pool: ${status}` };
    }
  };

  const style = getBadgeStyle();

  return (
    <View className={`px-2 py-0.5 rounded-md ${style.bg}`}>
      <Text className={`text-[10px] font-semibold capitalize ${style.text}`}>
        {style.label}
      </Text>
    </View>
  );
}
