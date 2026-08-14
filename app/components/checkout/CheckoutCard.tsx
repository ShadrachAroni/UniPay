import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, layout, typography } from '../../theme/tokens';
import { useCheckout } from '../../hooks/useCheckout';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { ProfileHeaderSkeleton } from '../ui/Skeleton';
import { FeeBreakdown } from './FeeBreakdown';
import { PaymentStatusView } from './PaymentStatusView';
import { Icon } from '../ui/Icon';

export interface CheckoutCardProps {
  alias: string;
  initialAmount?: number;
  apiBaseUrl?: string;
}

export function CheckoutCard({ alias, initialAmount, apiBaseUrl }: CheckoutCardProps) {
  const {
    step,
    recipient,
    loadingRecipient,
    recipientError,
    amount,
    payerPhone,
    setPayerPhone,
    handleAmountChange,
    paymentOption,
    loadingOption,
    optionError,
    paymentIntent,
    initiatingPayment,
    retryingPayment,
    paymentError,
    fetchRecipient,
    initiatePayment,
    retryPayment,
    resetCheckout,
  } = useCheckout({ alias, initialAmount, apiBaseUrl });

  const cleanHandle = alias.startsWith('@') ? alias : `@${alias}`;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        {/* UniPay Branding & Trust Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <Icon name="shield-check" size={18} color={colors.brandLight} />
            <Text style={styles.brandTitle}>UniPay Checkout</Text>
          </View>
          <Text style={styles.brandSub}>Instant, zero-friction KES settlement</Text>
        </View>

        <Card variant="glow" style={styles.card}>
          {/* 1. Recipient Profile Header / Skeleton / Error */}
          {loadingRecipient ? (
            <ProfileHeaderSkeleton />
          ) : recipientError ? (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={32} color={colors.error} />
              <Text style={styles.errorTitle}>Recipient Not Found</Text>
              <Text style={styles.errorSub}>{recipientError}</Text>
              <Button
                title="Try Again"
                onPress={fetchRecipient}
                variant="secondary"
                size="sm"
                icon="refresh-cw"
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            <View style={styles.recipientHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {(recipient?.display_name || cleanHandle)[0].toUpperCase()}
                </Text>
              </View>

              <View style={styles.recipientInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.recipientName} numberOfLines={1}>
                    {recipient?.display_name}
                  </Text>
                  {recipient?.is_verified && (
                    <VerifiedBadge
                      isVerified={true}
                      size="sm"
                      showLabel={false}
                    />
                  )}
                </View>

                <View style={styles.handleRow}>
                  <Text style={styles.handleText}>{cleanHandle}</Text>
                  <VerifiedBadge
                    isVerified={recipient?.is_verified}
                    status={recipient?.verification_status}
                    size="sm"
                    showLabel={true}
                  />
                </View>
              </View>
            </View>
          )}

          {/* 2. Step Views */}
          {!loadingRecipient && !recipientError && (
            <>
              {step === 'amount_entry' && (
                <View style={styles.formContainer}>
                  <View style={styles.divider} />

                  <Input
                    label="Payment Amount"
                    prefix="KES"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={handleAmountChange}
                    icon="dollar-sign"
                  />

                  {/* Fee transparency (§13) */}
                  <FeeBreakdown
                    option={paymentOption}
                    loading={loadingOption}
                    error={optionError}
                  />

                  <Input
                    label="Your Phone Number (For LOOP Push)"
                    placeholder="e.g. 0712 345 678"
                    keyboardType="phone-pad"
                    value={payerPhone}
                    onChangeText={setPayerPhone}
                    icon="phone"
                    helperText="A Request-to-Pay prompt will be sent to your LOOP mobile app."
                    error={paymentError}
                  />

                  <Button
                    title={
                      amount && parseFloat(amount) > 0
                        ? `Pay KES ${parseFloat(amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
                        : 'Enter Amount to Pay'
                    }
                    onPress={initiatePayment}
                    loading={initiatingPayment}
                    disabled={!amount || parseFloat(amount) <= 0}
                    variant="primary"
                    size="lg"
                    icon="arrow-right"
                    iconPosition="right"
                    style={{ marginTop: 8 }}
                  />
                </View>
              )}

              {(step === 'awaiting_payment' || step === 'completed' || step === 'failed') && (
                <PaymentStatusView
                  intent={paymentIntent}
                  recipient={recipient}
                  status={step}
                  errorMessage={paymentError}
                  retrying={retryingPayment}
                  onRetry={retryPayment}
                  onReset={resetCheckout}
                />
              )}
            </>
          )}
        </Card>

        {/* Security / Unauthenticated Guarantee Notice (§19) */}
        <View style={styles.footer}>
          <Icon name="lock" size={13} color={colors.textMuted} />
          <Text style={styles.footerText}>
            Secured by UniPay • No account or sign-in required to pay
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.spacing.md,
    backgroundColor: colors.bgDark,
  },
  container: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignItems: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: layout.spacing.md,
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  card: {
    width: '100%',
    padding: layout.spacing.lg,
  },
  recipientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  recipientInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipientName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  handleText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: layout.spacing.md,
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: layout.spacing.md,
    gap: 6,
  },
  errorTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.error,
  },
  errorSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: layout.spacing.md,
  },
  footerText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});
