import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, layout, typography } from '../../theme/tokens';
import { PaymentIntentResult, RecipientProfile } from '../../hooks/useCheckout';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';

export interface PaymentStatusViewProps {
  intent: PaymentIntentResult | null;
  recipient: RecipientProfile | null;
  status: 'awaiting_payment' | 'completed' | 'failed';
  errorMessage?: string | null;
  retrying?: boolean;
  onRetry: () => void;
  onReset: () => void;
}

export function PaymentStatusView({
  intent,
  recipient,
  status,
  errorMessage,
  retrying,
  onRetry,
  onReset,
}: PaymentStatusViewProps) {
  if (status === 'awaiting_payment') {
    return (
      <View style={styles.container}>
        <View style={[styles.iconCircle, styles.pendingCircle]}>
          <Icon name="refresh-cw" size={32} color={colors.brandLight} />
        </View>

        <Text style={styles.title}>Awaiting Payment Approval</Text>
        <Text style={styles.subtitle}>
          A LOOP Request-to-Pay prompt has been sent to your phone. Please approve the prompt to complete this transfer.
        </Text>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient</Text>
            <Text style={styles.detailValue}>{recipient?.display_name || intent?.recipient_alias}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValueHighlight}>
              {intent?.currency || 'KES'} {intent?.amount ? Number(intent.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '0.00'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rail</Text>
            <Text style={styles.detailValue}>{intent?.rail?.toUpperCase() || 'LOOP'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.skeletonRow}>
            <Skeleton width="100%" height={8} borderRadius={4} />
          </View>
        </View>
      </View>
    );
  }

  if (status === 'completed') {
    return (
      <View style={styles.container}>
        <View style={[styles.iconCircle, styles.successCircle]}>
          <Icon name="check" size={36} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.subtitle}>
          Funds have been instantly transferred to {recipient?.display_name || intent?.recipient_alias}.
        </Text>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount Paid</Text>
            <Text style={styles.successAmount}>
              {intent?.currency || 'KES'} {intent?.amount ? Number(intent.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '0.00'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient</Text>
            <Text style={styles.detailValue}>{recipient?.display_name || intent?.recipient_alias}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction ID</Text>
            <Text style={styles.detailMono}>{intent?.id?.slice(0, 18)}...</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={styles.completedStatus}>Settled (Instant)</Text>
          </View>
        </View>

        <Button
          title="Done / Make Another Payment"
          onPress={onReset}
          variant="primary"
          size="lg"
          style={{ width: '100%', marginTop: 8 }}
        />
      </View>
    );
  }

  // Failed state
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, styles.failedCircle]}>
        <Icon name="alert-circle" size={36} color="#FFFFFF" />
      </View>

      <Text style={styles.title}>Payment Declined or Timed Out</Text>
      <Text style={styles.subtitle}>
        {errorMessage || 'The payment request was not approved or timed out on your phone.'}
      </Text>

      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Attempted Amount</Text>
          <Text style={styles.detailValue}>
            {intent?.currency || 'KES'} {intent?.amount ? Number(intent.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '0.00'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Recipient</Text>
          <Text style={styles.detailValue}>{recipient?.display_name || intent?.recipient_alias}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Button
          title="Retry Payment"
          onPress={onRetry}
          loading={retrying}
          variant="primary"
          size="lg"
          icon="refresh-cw"
          style={{ flex: 1 }}
        />
        <Button
          title="Edit Details"
          onPress={onReset}
          variant="secondary"
          size="lg"
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: layout.spacing.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.md,
  },
  pendingCircle: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: colors.brandLight,
  },
  successCircle: {
    backgroundColor: colors.verified,
  },
  failedCircle: {
    backgroundColor: colors.error,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: layout.spacing.md,
    paddingHorizontal: layout.spacing.sm,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: colors.bgCardSubtle,
    borderRadius: layout.borderRadius.md,
    padding: layout.spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: layout.spacing.md,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  detailValueHighlight: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.brandLight,
  },
  detailMono: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
  },
  completedStatus: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.verified,
  },
  successAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.verified,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  skeletonRow: {
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
});
