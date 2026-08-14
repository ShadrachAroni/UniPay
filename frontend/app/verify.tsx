import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useToast } from '../components/Toast';
import { verifyOtp } from '../api/auth';
import { useAuth } from '../components/AuthProvider';
import { ChevronLeft } from 'lucide-react-native';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { tokens, isDark } = useTheme();
  const { showToast } = useToast();
  const { signIn } = useAuth();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  const handleVerify = async () => {
    if (!code) return;

    setIsLoading(true);
    try {
      const response = await verifyOtp(phone as string, code);
      await signIn(response.token, response.profile);
      showToast('Welcome back!', 'success');
      // AuthProvider useEffect will auto-redirect to /(tabs)
    } catch (e: any) {
      showToast(e.message || 'Invalid code', 'error');
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
      <View className="px-4 py-3">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="p-2 w-10 h-10 items-center justify-center rounded-full"
          style={{ backgroundColor: activeColors.surface }}
        >
          <ChevronLeft size={24} color={activeColors.text.primary} />
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-6 pt-6">
        <Text 
          className="font-bold"
          style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.xl }}
        >
          Verify your number
        </Text>
        <Text 
          className="mt-2 mb-8"
          style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.base }}
        >
          Enter the 4-digit code we sent to {phone} (use "0000" to mock login)
        </Text>

        <View 
          className="rounded-xl px-4 py-2 border mb-8"
          style={{ 
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border
          }}
        >
          <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs, marginTop: 4 }}>
            Verification Code
          </Text>
          <TextInput
            className="font-bold h-12 tracking-[8px]"
            style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.xl }}
            placeholder="0 0 0 0"
            placeholderTextColor={activeColors.text.muted}
            keyboardType="number-pad"
            maxLength={4}
            value={code}
            onChangeText={setCode}
            autoFocus
          />
        </View>

        <TouchableOpacity
          onPress={handleVerify}
          disabled={isLoading || code.length < 4}
          className="w-full items-center justify-center rounded-xl py-4"
          style={{ backgroundColor: tokens.colors.light.brand, opacity: (isLoading || code.length < 4) ? 0.7 : 1 }}
        >
          <Text style={{ color: '#ffffff', fontSize: tokens.typography.size.lg, fontWeight: '600' }}>
            {isLoading ? 'Verifying...' : 'Verify'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
