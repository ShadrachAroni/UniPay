import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { colors, typography } from '../../theme/tokens';

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
  const verified = isVerified || status === 'approved' || status === 'verified';

  if (!verified) {
    if (!showLabel) return null;
    return (
      <View style={[styles.badge, styles.unverifiedBadge]}>
        <Icon name="clock" size={size === 'sm' ? 12 : 14} color={colors.warning} />
        <Text style={[styles.badgeText, styles.unverifiedText]}>Unverified ID</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.verifiedBadge]}>
      <Icon
        name="check-circle"
        size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14}
        color={colors.verified}
      />
      {showLabel && (
        <Text style={[styles.badgeText, styles.verifiedText]}>Verified Merchant</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  verifiedBadge: {
    backgroundColor: colors.verifiedBg,
    borderWidth: 1,
    borderColor: colors.verifiedBorder,
  },
  unverifiedBadge: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  verifiedText: {
    color: colors.verified,
  },
  unverifiedText: {
    color: colors.warning,
  },
});
