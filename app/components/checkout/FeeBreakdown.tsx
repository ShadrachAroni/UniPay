import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, layout, typography } from '../../theme/tokens';
import { PaymentOption } from '../../hooks/useCheckout';
import { FeeBreakdownSkeleton } from '../ui/Skeleton';
import { Icon } from '../ui/Icon';

export interface FeeBreakdownProps {
  option: PaymentOption | null;
  loading: boolean;
  error?: string | null;
}

export function FeeBreakdown({ option, loading, error }: FeeBreakdownProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <FeeBreakdownSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Icon name="alert-circle" size={14} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!option) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Transparent Fee Summary (§13)</Text>
        <View style={styles.settlementBadge}>
          <Icon name="shield-check" size={12} color={colors.brandLight} />
          <Text style={styles.settlementText}>
            {option.settlement_estimate === 'instant' ? 'Instant Settlement' : option.settlement_estimate}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Payer Total</Text>
        <Text style={styles.value}>
          {option.currency} {option.amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.labelSubtle}>Estimated Processing Fee</Text>
        <Text style={styles.valueSubtle}>
          − {option.currency} {option.estimated_fee.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.recipientLabel}>Recipient Nets</Text>
        <Text style={styles.recipientValue}>
          {option.currency} {option.estimated_recipient_amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCardSubtle,
    borderRadius: layout.borderRadius.md,
    padding: layout.spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: 6,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settlementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  settlementText: {
    fontSize: 10,
    color: colors.brandLight,
    fontWeight: typography.weights.medium,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  value: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  labelSubtle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  valueSubtle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  recipientLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.verified,
  },
  recipientValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.verified,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: colors.errorBg,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    flex: 1,
  },
});
