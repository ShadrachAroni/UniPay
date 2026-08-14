import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';

export default function GuestCheckoutStatusScreen() {
  const params = useLocalSearchParams<{
    intentId: string;
    amount: string;
    recipientName: string;
    status: string;
  }>();
  const { tokens, activeColors } = useTheme();
  const router = useRouter();

  const isSuccess = params.status !== 'failed';
  const parsedAmount = parseFloat(params.amount || '0');
  const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const refNumber = params.intentId
    ? `MPESA_${params.intentId.toUpperCase()}`
    : 'MPESA_STK_99210';

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: tokens.spacing.xl,
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-6"
          style={{
            backgroundColor: isSuccess
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
          }}
        >
          {isSuccess ? (
            <CheckCircle2 size={48} color={tokens.colors.semantic.success} />
          ) : (
            <AlertTriangle size={48} color={tokens.colors.semantic.error} />
          )}
        </View>

        <Text className="font-bold text-2xl text-center mb-2" style={{ color: activeColors.text.primary }}>
          {isSuccess ? 'Payment Successful!' : 'Payment Failed'}
        </Text>

        <Text className="text-center text-sm px-4 mb-8" style={{ color: activeColors.text.secondary }}>
          {isSuccess
            ? `Your payment to ${params.recipientName || 'the merchant'} has been authorized and completed.`
            : 'The transaction could not be processed. Please check your phone balance and try again.'}
        </Text>

        {isSuccess && (
          <View
            className="w-full rounded-2xl p-5 mb-8 border"
            style={{ backgroundColor: activeColors.surface, borderColor: activeColors.border }}
          >
            <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-slate-800">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                Reference Number
              </Text>
              <Text className="font-bold font-mono text-sm" style={{ color: activeColors.text.primary }}>
                {refNumber}
              </Text>
            </View>

            <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-slate-800">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                Recipient
              </Text>
              <Text className="font-semibold text-sm" style={{ color: activeColors.text.primary }}>
                {params.recipientName || 'Merchant'}
              </Text>
            </View>

            <View className="flex-row justify-between pt-3">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                Amount Paid
              </Text>
              <Text className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                KES {safeAmount.toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.replace('/')}
          className="w-full py-4 rounded-xl flex-row items-center justify-center"
          style={{ backgroundColor: tokens.colors.light.brand }}
        >
          <Text className="font-bold text-white text-base mr-2">
            {isSuccess ? 'Done' : 'Try Again'}
          </Text>
          <ArrowRight size={20} color="#ffffff" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
