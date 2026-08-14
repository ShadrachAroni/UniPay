import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useCheckout } from '../../hooks/useCheckout';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { ProfileHeaderSkeleton } from '../ui/Skeleton';
import { FeeBreakdown } from './FeeBreakdown';
import { PaymentStatusView } from './PaymentStatusView';
import { ThemeToggle } from '../../theme/ThemeToggle';
import { ShieldCheck, AlertCircle, RefreshCw, Lock, ArrowRight } from 'lucide-react-native';

export interface CheckoutCardProps {
  alias: string;
  initialAmount?: number;
  apiBaseUrl?: string;
}

export function CheckoutCard({ alias, initialAmount, apiBaseUrl }: CheckoutCardProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

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
      contentContainerStyle={[styles.scrollContainer, { backgroundColor: activeColors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        {/* Top Controls / Brand Header */}
        <View style={styles.topBar}>
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <View
                className="w-8 h-8 rounded-full items-center justify-center mr-2"
                style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe' }}
              >
                <ShieldCheck size={18} color={activeColors.brand} />
              </View>
              <Text style={[styles.brandTitle, { color: activeColors.text.primary }]}>
                UniPay Checkout
              </Text>
            </View>
            <Text style={[styles.brandSub, { color: activeColors.text.muted }]}>
              Instant, zero-friction KES settlement
            </Text>
          </View>

          <View style={styles.themeToggleContainer}>
            <ThemeToggle />
          </View>
        </View>

        <Card variant="glow" style={styles.card}>
          {/* 1. Recipient Profile Header / Skeleton / Error */}
          {loadingRecipient ? (
            <ProfileHeaderSkeleton />
          ) : recipientError ? (
            <View style={styles.errorContainer}>
              <AlertCircle size={32} color={tokens.colors.semantic.error} />
              <Text style={[styles.errorTitle, { color: tokens.colors.semantic.error }]}>
                Recipient Not Found
              </Text>
              <Text style={[styles.errorSub, { color: activeColors.text.secondary }]}>
                {recipientError}
              </Text>
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
              <Avatar
                name={recipient?.display_name || cleanHandle}
                id={recipient?.profile_id}
                size={48}
              />

              <View style={styles.recipientInfo}>
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.recipientName, { color: activeColors.text.primary }]}
                    numberOfLines={1}
                  >
                    {recipient?.display_name}
                  </Text>
                  {recipient?.is_verified && (
                    <VerifiedBadge isVerified={true} size="sm" showLabel={false} />
                  )}
                </View>

                <View style={styles.handleRow}>
                  <Text style={[styles.handleText, { color: activeColors.text.muted }]}>
                    {cleanHandle}
                  </Text>
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
                  <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

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
          <Lock size={13} color={activeColors.text.muted} />
          <Text style={[styles.footerText, { color: activeColors.text.muted }]}>
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
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 12,
  },
  themeToggleContainer: {
    width: '100%',
    maxWidth: 240,
    marginTop: 4,
  },
  card: {
    width: '100%',
    padding: 20,
  },
  recipientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  handleText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
  },
});
