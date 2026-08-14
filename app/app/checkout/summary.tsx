import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Smartphone, ArrowRight } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { getFeeEstimate, createPaymentIntent } from '../../api/checkout';
import { Header } from '../../components/ui/Header';

export default function GuestCheckoutSummaryScreen() {
  const params = useLocalSearchParams<{
    alias: string;
    recipientName: string;
    recipientId: string;
    amount: string;
  }>();
  const { tokens, activeColors } = useTheme();
  const router = useRouter();

  const [feeBreakdown, setFeeBreakdown] = useState<{
    totalPayerAmount: number;
    recipientReceivesAmount: number;
    fee: number;
  } | null>(null);
  const [payerPhone, setPayerPhone] = useState('+254 7');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invalidAmount, setInvalidAmount] = useState(false);

  const rawAmount = parseFloat(params.amount || '0');

  useEffect(() => {
    async function loadFee() {
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        setInvalidAmount(true);
        setLoading(false);
        return;
      }

      try {
        const estimate = await getFeeEstimate(rawAmount, params.alias);
        setFeeBreakdown(estimate);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadFee();
  }, [rawAmount, params.alias]);

  const handlePayNow = async () => {
    if (!payerPhone || payerPhone.length < 9) {
      return;
    }
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return;
    }
    setSubmitting(true);

    try {
      const intent = await createPaymentIntent(
        rawAmount,
        params.recipientId || 'p-1001',
        payerPhone,
        params.alias
      );
      router.push({
        pathname: '/checkout/pending',
        params: {
          intentId: intent.id,
          payerPhone,
          amount: rawAmount.toString(),
          recipientName: params.recipientName || 'Merchant',
          providerReference: intent.provider_reference || '',
        },
      });
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: activeColors.background }}>
        <ActivityIndicator size="large" color={tokens.colors.light.brand} />
      </View>
    );
  }

  if (invalidAmount || !feeBreakdown) {
    return (
      <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
        <Header title="Payment Summary" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-semibold" style={{ color: tokens.colors.semantic.error }}>
            Invalid payment amount.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: activeColors.background }}
    >
      <Header title="Payment Summary" showBack />

      <ScrollView
        contentContainerStyle={{ padding: tokens.spacing.lg, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="rounded-2xl p-5 mb-6 border"
          style={{ backgroundColor: activeColors.surface, borderColor: activeColors.border }}
        >
          <Text
            className="text-xs font-bold uppercase mb-4"
            style={{ color: activeColors.text.secondary }}
          >
            Fee Transparency Breakdown
          </Text>

          <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-slate-800">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              Recipient Receives
            </Text>
            <Text className="font-semibold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
              KES {feeBreakdown.recipientReceivesAmount.toLocaleString()}
            </Text>
          </View>

          <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-slate-800">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              Platform Processing Fee
            </Text>
            <Text className="font-semibold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
              KES {feeBreakdown.fee.toLocaleString()}
            </Text>
          </View>

          <View className="flex-row justify-between pt-3 mt-1">
            <Text className="font-bold text-base" style={{ color: activeColors.text.primary }}>
              You Pay Total
            </Text>
            <Text className="font-bold text-xl text-emerald-600 dark:text-emerald-400">
              KES {feeBreakdown.totalPayerAmount.toLocaleString()}
            </Text>
          </View>
        </View>

        <View
          className="rounded-2xl p-5 mb-6 border"
          style={{ backgroundColor: activeColors.surface, borderColor: activeColors.border }}
        >
          <Text
            className="text-xs font-bold uppercase mb-2"
            style={{ color: activeColors.text.secondary }}
          >
            M-PESA Phone Number to Charge
          </Text>
          <View className="flex-row items-center h-12 px-3 rounded-xl border border-gray-200 dark:border-slate-800">
            <Smartphone size={20} color={tokens.colors.light.brand} />
            <TextInput
              className="flex-1 font-bold text-base ml-2"
              style={{ color: activeColors.text.primary }}
              placeholder="+254 7XX XXX XXX"
              placeholderTextColor={activeColors.text.muted}
              keyboardType="phone-pad"
              value={payerPhone}
              onChangeText={setPayerPhone}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handlePayNow}
          disabled={submitting || payerPhone.length < 10}
          className="w-full py-4 rounded-xl flex-row items-center justify-center"
          style={{ backgroundColor: tokens.colors.light.brand, opacity: submitting ? 0.7 : 1 }}
        >
          <Text className="font-bold text-white text-base mr-2">
            {submitting
              ? 'Initiating STK Push...'
              : `Pay KES ${feeBreakdown.totalPayerAmount.toLocaleString()}`}
          </Text>
          <ArrowRight size={20} color="#ffffff" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
