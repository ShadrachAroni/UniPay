import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { CheckCircle2, Clock } from 'lucide-react-native';

export interface VerifiedBadgeProps {
  status?: string;
  isVerified?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function VerifiedBadge({
  status,
  isVerified,
  size = 'md',
  showLabel = true,
}: VerifiedBadgeProps) {
  const { tokens, isDark } = useTheme();
  const verified = isVerified || status === 'approved' || status === 'verified';
  const isSm = size === 'sm';
  const isLg = size === 'lg';
  const iconSize = isSm ? 12 : isLg ? 16 : 14;

  if (!verified) {
    if (!showLabel) return null;
    return (
      <View
        className="flex-row items-center rounded-full border px-2 py-0.5"
        style={{
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
          borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
        }}
      >
        <Clock size={iconSize} color={tokens.colors.semantic.warning} />
        <Text
          className="ml-1 font-semibold"
          style={{
            fontSize: isSm ? 10 : 11,
            color: tokens.colors.semantic.warning,
          }}
        >
          Unverified ID
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center rounded-full border px-2 py-0.5"
      style={{
        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
        borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#86efac',
      }}
    >
      <CheckCircle2 size={iconSize} color={tokens.colors.semantic.success} />
      {showLabel && (
        <Text
          className="ml-1 font-semibold"
          style={{
            fontSize: isSm ? 10 : 11,
            color: tokens.colors.semantic.success,
          }}
        >
          Verified Merchant
        </Text>
      )}
    </View>
  );
}
