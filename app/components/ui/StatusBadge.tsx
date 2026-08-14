import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type StatusBadgeType = 'payment' | 'settlement' | 'pool';

export interface StatusBadgeProps {
  type: StatusBadgeType;
  status: string;
}

export function StatusBadge({ type, status }: StatusBadgeProps) {
  const { tokens, isDark } = useTheme();

  const getBadgeStyle = () => {
    const s = String(status).toLowerCase();

    if (type === 'payment') {
      switch (s) {
        case 'completed':
        case 'succeeded':
          return {
            bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
            text: '#059669',
            label: `Payment: ${status}`,
          };
        case 'pending':
          return {
            bg: isDark ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9',
            text: isDark ? '#cbd5e1' : '#475569',
            label: `Payment: ${status}`,
          };
        case 'processing':
          return {
            bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
            text: '#d97706',
            label: `Payment: ${status}`,
          };
        case 'failed':
        case 'refunded':
        case 'cancelled':
          return {
            bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
            text: '#dc2626',
            label: `Payment: ${status}`,
          };
        default:
          return {
            bg: isDark ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9',
            text: isDark ? '#cbd5e1' : '#475569',
            label: `Payment: ${status}`,
          };
      }
    }

    if (type === 'settlement') {
      switch (s) {
        case 'settled':
          return {
            bg: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
            text: '#16a34a',
            label: `Settlement: ${status}`,
          };
        case 'processing':
          return {
            bg: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
            text: '#2563eb',
            label: `Settlement: ${status}`,
          };
        case 'pending':
          return {
            bg: isDark ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9',
            text: isDark ? '#cbd5e1' : '#475569',
            label: `Settlement: ${status}`,
          };
        case 'failed':
          return {
            bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
            text: '#dc2626',
            label: `Settlement: ${status}`,
          };
        default:
          return {
            bg: isDark ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9',
            text: isDark ? '#cbd5e1' : '#475569',
            label: `Settlement: ${status}`,
          };
      }
    }

    switch (s) {
      case 'paid':
        return {
          bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
          text: '#059669',
          label: `Pool: ${status}`,
        };
      case 'partially_paid':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
          text: '#d97706',
          label: `Pool: ${status}`,
        };
      case 'unpaid':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
          text: '#dc2626',
          label: `Pool: ${status}`,
        };
      default:
        return {
          bg: isDark ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9',
          text: isDark ? '#cbd5e1' : '#475569',
          label: `Pool: ${status}`,
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <View
      className="px-2 py-0.5 rounded-md"
      style={{ backgroundColor: style.bg }}
    >
      <Text
        className="text-[10px] font-semibold capitalize"
        style={{ color: style.text }}
      >
        {style.label}
      </Text>
    </View>
  );
}
