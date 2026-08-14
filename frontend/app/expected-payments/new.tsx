import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/Header';
import { useToast } from '../../components/Toast';
import { createExpectedPayment } from '../../api/expectedPayments';
import { Calendar, User, DollarSign } from 'lucide-react-native';

export default function NewExpectedPaymentScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();
  const { showToast } = useToast();

  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [payerRef, setPayerRef] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reference || !amount) {
      showToast('Reference and amount are required', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await createExpectedPayment({
        owner_profile_id: 'prof_123',
        reference,
        amount: parseFloat(amount),
        payer_reference: payerRef,
        due_at: new Date(Date.now() + 86400000 * 7).toISOString(), // Mock 7 days from now
      });
      showToast('Expected payment created', 'success');
      router.back();
    } catch (e: any) {
      showToast(e.message || 'Error creating payment', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const InputField = ({ icon: Icon, label, placeholder, value, onChangeText, keyboardType = 'default' }: any) => (
    <View className="mb-5">
      <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 6 }}>
        {label}
      </Text>
      <View 
        className="flex-row items-center px-4 py-1 rounded-xl border"
        style={{ backgroundColor: activeColors.surface, borderColor: activeColors.border }}
      >
        <Icon size={18} color={activeColors.text.muted} />
        <TextInput
          className="flex-1 ml-3 h-12 font-medium"
          style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}
          placeholder={placeholder}
          placeholderTextColor={activeColors.text.muted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      style={{ backgroundColor: activeColors.background }}
    >
      <Header title="New Expected Payment" />
      
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
        <InputField 
          icon={User}
          label="Payment Reference / Title" 
          placeholder="e.g. Rent Payment - Aug"
          value={reference}
          onChangeText={setReference}
        />

        <InputField 
          icon={DollarSign}
          label="Amount (KES)" 
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <InputField 
          icon={User}
          label="Payer Phone / Reference (Optional)" 
          placeholder="+254..."
          value={payerRef}
          onChangeText={setPayerRef}
          keyboardType="phone-pad"
        />

        {/* Due date mock input */}
        <View className="mb-8">
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 6 }}>
            Due Date
          </Text>
          <View 
            className="flex-row items-center px-4 h-14 rounded-xl border"
            style={{ backgroundColor: activeColors.surface, borderColor: activeColors.border }}
          >
            <Calendar size={18} color={activeColors.text.muted} />
            <Text className="ml-3 font-medium" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
              7 days from now (Mock)
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isLoading}
          className="w-full items-center justify-center rounded-xl py-4"
          style={{ backgroundColor: tokens.colors.light.brand, opacity: isLoading ? 0.7 : 1 }}
        >
          <Text style={{ color: '#ffffff', fontSize: tokens.typography.size.lg, fontWeight: '600' }}>
            {isLoading ? 'Creating...' : 'Create Payment'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
