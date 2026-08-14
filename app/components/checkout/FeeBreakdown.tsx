import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { PaymentOption } from '../../hooks/useCheckout';
import { FeeBreakdownSkeleton } from '../ui/Skeleton';
import { ShieldCheck, AlertCircle } from 'lucide-react-native';

export interface FeeBreakdownProps {
  option: PaymentOption | null;
  loading: boolean;
  error?: string | null;
}

export function FeeBreakdown({ option, loading, error }: FeeBreakdownProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: activeColors.surfaceSubtle,
            borderColor: activeColors.borderSubtle,
            borderRadius: tokens.borderRadius.md,
          },
        ]}
      >
        <FeeBreakdownSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: tokens.colors.semantic.errorBg,
            borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
            borderRadius: tokens.borderRadius.md,
          },
        ]}
      >
        <AlertCircle size={15} color={tokens.colors.semantic.error} />
        <Text style={[styles.errorText, { color: tokens.colors.semantic.error }]}>{error}</Text>
      </View>
    );
  }

  if (!option) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: activeColors.surfaceSubtle,
          borderColor: activeColors.border,
          borderRadius: tokens.borderRadius.md,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={{
            fontSize: tokens.typography.size.xs,
            fontWeight: '600',
            color: activeColors.text.muted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Fee Transparency (§13)
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
          }}
        >
          <ShieldCheck size={12} color={activeColors.brand} />
          <Text
            style={{
              fontSize: 10,
              color: activeColors.brand,
              fontWeight: '500',
              marginLeft: 4,
            }}
          >
            {option.settlement_estimate === 'instant' ? 'Instant Settlement' : option.settlement_estimate}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={{ fontSize: tokens.typography.size.sm, color: activeColors.text.secondary }}>
          Payer Total
        </Text>
        <Text style={{ fontSize: tokens.typography.size.sm, fontWeight: '600', color: activeColors.text.primary }}>
          {option.currency} {option.amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={{ fontSize: tokens.typography.size.xs, color: activeColors.text.muted }}>
          Estimated Processing Fee
        </Text>
        <Text style={{ fontSize: tokens.typography.size.xs, color: activeColors.text.muted }}>
          − {option.currency} {option.estimated_fee.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

      <View style={styles.row}>
        <Text style={{ fontSize: tokens.typography.size.sm, fontWeight: '600', color: tokens.colors.semantic.success }}>
          Recipient Nets
        </Text>
        <Text style={{ fontSize: tokens.typography.size.base, fontWeight: '700', color: tokens.colors.semantic.success }}>
          {option.currency} {option.estimated_recipient_amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  divider: {
    height: 1,
    marginVertical: 6,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
    marginLeft: 6,
  },
});
