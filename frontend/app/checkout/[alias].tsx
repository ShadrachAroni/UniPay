import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { resolveAlias } from '../../api/checkout';
import { Profile } from '../../api/types';
import { VerifiedCheckmark } from '../../components/VerifiedCheckmark';
import { Avatar } from '../../components/Avatar';
import { ArrowRight } from 'lucide-react-native';

export default function GuestCheckoutAmountScreen() {
  const { alias } = useLocalSearchParams<{ alias: string }>();
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();

  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    async function loadRecipient() {
      try {
        const data = await resolveAlias(alias || 'acme');
        setRecipient(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadRecipient();
  }, [alias]);

  if (loading || !recipient) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: activeColors.background }}>
        <ActivityIndicator size="large" color={tokens.colors.light.brand} />
      </View>
    );
  }

  const recipientDisplayName = recipient.account_type === 'business'
    ? (recipient.business_name || recipient.display_name)
    : (recipient.owner_name || recipient.display_name);

  const handleNext = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;

    router.push({
      pathname: '/checkout/summary',
      params: {
        alias: alias || 'acme',
        recipientName: recipientDisplayName,
        recipientId: recipient.id,
        amount: num.toString(),
      }
    });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: activeColors.background }}
    >
      <ScrollView 
        contentContainerStyle={{ padding: tokens.spacing.xl, flexGrow: 1, justifyContent: 'center', paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* Recipient Header Card */}
        <View className="items-center mb-8">
          <Avatar name={recipientDisplayName} size={72} />
          <View className="flex-row items-center mt-3">
            <Text className="font-bold text-xl" style={{ color: activeColors.text.primary }}>
              {recipientDisplayName}
            </Text>
            {recipient.verification_status === 'verified' && <VerifiedCheckmark size={20} />}
          </View>
          <Text className="text-xs mt-1" style={{ color: activeColors.text.secondary }}>
            Paying @{alias || 'merchant'} • UniPay Checkout
          </Text>
        </View>

        {/* Amount Entry Input */}
        <View 
          className="rounded-2xl p-6 mb-8 border"
          style={{ backgroundColor: activeColors.surface, borderColor: activeColors.border }}
        >
          <Text className="text-xs font-semibold uppercase mb-2" style={{ color: activeColors.text.secondary }}>
            Enter Payment Amount (KES)
          </Text>
          <View className="flex-row items-center border-b pb-2 border-gray-200 dark:border-slate-800">
            <Text className="font-bold text-2xl mr-2" style={{ color: tokens.colors.light.brand }}>KES</Text>
            <TextInput
              className="flex-1 font-bold text-3xl"
              style={{ color: activeColors.text.primary }}
              placeholder="0"
              placeholderTextColor={activeColors.text.muted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleNext}
          disabled={!amount || parseFloat(amount) <= 0}
          className="w-full py-4 rounded-xl flex-row items-center justify-center"
          style={{ 
            backgroundColor: tokens.colors.light.brand, 
            opacity: (!amount || parseFloat(amount) <= 0) ? 0.5 : 1 
          }}
        >
          <Text className="font-bold text-white text-base mr-2">Review & Fee Breakdown</Text>
          <ArrowRight size={20} color="#ffffff" />
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
