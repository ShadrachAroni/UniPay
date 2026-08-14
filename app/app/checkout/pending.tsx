import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Smartphone } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';

export default function GuestCheckoutPendingScreen() {
  const params = useLocalSearchParams<{
    intentId: string;
    payerPhone: string;
    amount: string;
    recipientName: string;
  }>();
  const { tokens, activeColors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/checkout/status',
        params: {
          intentId: params.intentId || 'pi_123',
          amount: params.amount || '0',
          recipientName: params.recipientName || 'Merchant',
          status: 'success',
        },
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [params.amount, params.intentId, params.recipientName, router]);

  return (
    <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: activeColors.background }}>
      <View className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-950/60 items-center justify-center mb-6">
        <Smartphone size={36} color={tokens.colors.light.brand} />
      </View>

      <Text className="font-bold text-2xl text-center mb-2" style={{ color: activeColors.text.primary }}>
        Check Your Phone
      </Text>

      <Text className="text-center text-sm px-6 mb-8 leading-6" style={{ color: activeColors.text.secondary }}>
        An M-PESA payment prompt has been sent to{' '}
        <Text className="font-bold" style={{ color: activeColors.text.primary }}>
          {params.payerPhone || 'your phone'}
        </Text>
        . Enter your PIN to complete paying{' '}
        <Text className="font-bold" style={{ color: activeColors.text.primary }}>
          {params.recipientName}
        </Text>
        .
      </Text>

      <ActivityIndicator size="large" color={tokens.colors.light.brand} />
      <Text className="text-xs text-gray-400 mt-4 font-semibold uppercase tracking-wider">
        Waiting for STK PIN authorization...
      </Text>
    </View>
  );
}
