import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Share2, QrCode, ArrowRight } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/ui/Header';
import { createExpectedPayment } from '../../api/expectedPayments';
import { useToast } from '../../components/ui/Toast';

export default function CreateExpectedPaymentScreen() {
  const { tokens, activeColors } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();

  const [reference, setReference] = useState('');
  const [payerRef, setPayerRef] = useState('');
  const [amount, setAmount] = useState('');
  const [isCreated, setIsCreated] = useState(false);

  const handleCreate = async () => {
    if (!reference || !amount) {
      showToast('Reference and amount are required', 'error');
      return;
    }
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    try {
      await createExpectedPayment({
        reference,
        payer_reference: payerRef || 'Unassigned',
        amount: num,
      });
      setIsCreated(true);
      showToast('Expected Payment Created!', 'success');
    } catch {
      showToast('Failed to create expected payment', 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: activeColors.background }}
    >
      <Header title="New Expected Payment" showBack />

      <ScrollView
        contentContainerStyle={{ padding: tokens.spacing.lg, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {!isCreated ? (
          <>
            <View className="mb-4">
              <Text
                style={{
                  color: activeColors.text.secondary,
                  fontSize: tokens.typography.size.sm,
                  marginBottom: 6,
                }}
              >
                Payment Reference / Description *
              </Text>
              <TextInput
                className="px-4 h-12 rounded-xl border font-medium"
                style={{
                  backgroundColor: activeColors.surface,
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                }}
                placeholder="e.g. Invoice #1042 Software Dev"
                placeholderTextColor={activeColors.text.muted}
                value={reference}
                onChangeText={setReference}
              />
            </View>

            <View className="mb-4">
              <Text
                style={{
                  color: activeColors.text.secondary,
                  fontSize: tokens.typography.size.sm,
                  marginBottom: 6,
                }}
              >
                Target Payer (Phone / Name)
              </Text>
              <TextInput
                className="px-4 h-12 rounded-xl border font-medium"
                style={{
                  backgroundColor: activeColors.surface,
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                }}
                placeholder="+254 712 345 678 or Acme Client"
                placeholderTextColor={activeColors.text.muted}
                value={payerRef}
                onChangeText={setPayerRef}
              />
            </View>

            <View className="mb-6">
              <Text
                style={{
                  color: activeColors.text.secondary,
                  fontSize: tokens.typography.size.sm,
                  marginBottom: 6,
                }}
              >
                Expected Amount (KES) *
              </Text>
              <TextInput
                className="px-4 h-12 rounded-xl border font-bold text-lg"
                style={{
                  backgroundColor: activeColors.surface,
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                }}
                placeholder="0.00"
                placeholderTextColor={activeColors.text.muted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <TouchableOpacity
              onPress={handleCreate}
              className="w-full py-4 rounded-xl items-center justify-center flex-row bg-blue-600"
            >
              <Text className="font-bold text-white text-base mr-2">
                Generate Expected Payment Link
              </Text>
              <ArrowRight size={20} color="#ffffff" />
            </TouchableOpacity>
          </>
        ) : (
          <View className="items-center py-6">
            <View className="w-44 h-44 rounded-3xl bg-white p-4 items-center justify-center mb-6 border border-gray-200 shadow-md">
              <QrCode size={120} color="#0f172a" />
              <Text className="text-[10px] font-bold text-slate-500 mt-1 uppercase">
                UniPay Payment QR
              </Text>
            </View>

            <Text
              className="font-bold text-xl mb-1"
              style={{ color: activeColors.text.primary }}
            >
              Expected Payment Ready
            </Text>
            <Text
              className="text-center text-sm px-6 mb-6"
              style={{ color: activeColors.text.secondary }}
            >
              Share this link or QR code with your client to track payment reconciliation automatically.
            </Text>

            <TouchableOpacity
              onPress={() => {
                showToast('Link copied to clipboard!', 'success');
                router.replace('/expected-payments');
              }}
              className="w-full py-4 rounded-xl flex-row items-center justify-center bg-blue-600 mb-3"
            >
              <Share2 size={20} color="#ffffff" />
              <Text className="font-bold text-white text-base ml-2">Share Link with Client</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
