import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { PaymentIntentResult, RecipientProfile } from '../../hooks/useCheckout';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react-native';

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
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  if (status === 'awaiting_payment') {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
              borderColor: activeColors.brand,
            },
          ]}
        >
          <RefreshCw size={30} color={activeColors.brand} />
        </View>

        <Text style={[styles.title, { color: activeColors.text.primary }]}>
          Awaiting Payment Approval
        </Text>
        <Text style={[styles.subtitle, { color: activeColors.text.secondary }]}>
          A LOOP Request-to-Pay prompt has been sent to your phone. Please approve the prompt to complete this transfer.
        </Text>

        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: activeColors.surfaceSubtle,
              borderColor: activeColors.border,
              borderRadius: tokens.borderRadius.md,
            },
          ]}
        >
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Recipient</Text>
            <Text style={[styles.detailValue, { color: activeColors.text.primary }]}>
              {recipient?.display_name || intent?.recipient_alias}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Amount</Text>
            <Text style={[styles.detailValueHighlight, { color: activeColors.brand }]}>
              {intent?.currency || 'KES'} {intent?.amount ? Number(intent.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '0.00'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Rail</Text>
            <Text style={[styles.detailValue, { color: activeColors.text.primary }]}>
              {intent?.rail?.toUpperCase() || 'LOOP'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: activeColors.border }]} />
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
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: tokens.colors.semantic.success,
            },
          ]}
        >
          <CheckCircle2 size={34} color="#FFFFFF" />
        </View>

        <Text style={[styles.title, { color: activeColors.text.primary }]}>
          Payment Successful!
        </Text>
        <Text style={[styles.subtitle, { color: activeColors.text.secondary }]}>
          Funds have been instantly transferred to {recipient?.display_name || intent?.recipient_alias}.
        </Text>

        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: activeColors.surfaceSubtle,
              borderColor: activeColors.border,
              borderRadius: tokens.borderRadius.md,
            },
          ]}
        >
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Amount Paid</Text>
            <Text style={[styles.successAmount, { color: tokens.colors.semantic.success }]}>
              {intent?.currency || 'KES'} {intent?.amount ? Number(intent.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '0.00'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Recipient</Text>
            <Text style={[styles.detailValue, { color: activeColors.text.primary }]}>
              {recipient?.display_name || intent?.recipient_alias}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Transaction ID</Text>
            <Text style={[styles.detailMono, { color: activeColors.text.secondary }]}>
              {intent?.id?.slice(0, 18)}...
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Status</Text>
            <Text style={[styles.completedStatus, { color: tokens.colors.semantic.success }]}>
              Settled (Instant)
            </Text>
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
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: tokens.colors.semantic.error,
          },
        ]}
      >
        <AlertCircle size={34} color="#FFFFFF" />
      </View>

      <Text style={[styles.title, { color: activeColors.text.primary }]}>
        Payment Declined or Timed Out
      </Text>
      <Text style={[styles.subtitle, { color: activeColors.text.secondary }]}>
        {errorMessage || 'The payment request was not approved or timed out on your phone.'}
      </Text>

      <View
        style={[
          styles.detailsCard,
          {
            backgroundColor: activeColors.surfaceSubtle,
            borderColor: activeColors.border,
            borderRadius: tokens.borderRadius.md,
          },
        ]}
      >
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Attempted Amount</Text>
          <Text style={[styles.detailValue, { color: activeColors.text.primary }]}>
            {intent?.currency || 'KES'} {intent?.amount ? Number(intent.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '0.00'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: activeColors.text.muted }]}>Recipient</Text>
          <Text style={[styles.detailValue, { color: activeColors.text.primary }]}>
            {recipient?.display_name || intent?.recipient_alias}
          </Text>
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
    paddingVertical: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  detailsCard: {
    width: '100%',
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailValueHighlight: {
    fontSize: 15,
    fontWeight: '700',
  },
  detailMono: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  completedStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  successAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
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
