import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useToast } from '../components/Toast';
import { login } from '../api/auth';
import { ShieldCheck } from 'lucide-react-native';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { tokens, isDark } = useTheme();
  const { showToast } = useToast();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  const handleLogin = async () => {
    if (!phone) {
      showToast('Please enter your phone number', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await login(phone);
      showToast('OTP sent successfully', 'success');
      router.push({ pathname: '/verify', params: { phone } });
    } catch (e: any) {
      showToast(e.message || 'Failed to send OTP', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      style={{ backgroundColor: activeColors.background }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: tokens.spacing.lg, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-10">
          <View 
            className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
            style={{ backgroundColor: tokens.colors.light.brand }}
          >
            <ShieldCheck size={32} color="#ffffff" />
          </View>
          <Text 
            className="font-bold text-center"
            style={{ color: activeColors.text.primary, fontSize: tokens.typography.size['2xl'] }}
          >
            Welcome to UniPay
          </Text>
          <Text 
            className="text-center mt-2"
            style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.base }}
          >
            Enter your phone number to continue
          </Text>
        </View>

        <View 
          className="rounded-2xl px-5 py-3 border mb-8"
          style={{ 
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
            ...tokens.elevation[isDark ? 'dark' : 'light'].card
          }}
        >
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, fontWeight: '500', marginBottom: 4 }}>
            Phone Number
          </Text>
          <TextInput
            className="font-semibold h-12"
            style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}
            placeholder="+254 700 000000"
            placeholderTextColor={activeColors.text.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={isLoading}
          className="w-full items-center justify-center rounded-xl py-4"
          style={{ 
            backgroundColor: tokens.colors.light.brand, 
            opacity: isLoading ? 0.7 : 1,
            ...tokens.elevation[isDark ? 'dark' : 'light'].card
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: tokens.typography.size.lg, fontWeight: '600' }}>
            {isLoading ? 'Sending...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
