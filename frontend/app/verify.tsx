import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useToast } from '../components/Toast';
import { verifyOtp } from '../api/auth';
import { useAuth } from '../components/AuthProvider';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = React.useRef<TextInput>(null);
  
  const router = useRouter();
  const { tokens, isDark } = useTheme();
  const { showToast } = useToast();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
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
      {/* Top Header / Back Action */}
      <View 
        className="px-4 pb-3"
        style={{ paddingTop: Math.max(insets.top, tokens.spacing.sm) }}
      >
        <TouchableOpacity 
          onPress={() => router.back()}
          className="p-2 w-10 h-10 items-center justify-center rounded-full"
          style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
        >
          <ChevronLeft size={24} color={activeColors.text.primary} />
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-6 pt-8">
        <Text 
          className="font-bold text-center mb-2"
          style={{ color: activeColors.text.primary, fontSize: tokens.typography.size['2xl'] }}
        >
          Verify Phone Number
        </Text>
        <Text 
          className="text-center mb-10 px-2"
          style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.base, lineHeight: 22 }}
        >
          Enter the 4-digit code sent to <Text className="font-semibold" style={{ color: activeColors.text.primary }}>{phone || 'your phone'}</Text> (use <Text className="font-bold text-blue-500">0000</Text> to test)
        </Text>

        {/* 4-Digit OTP Box Grid */}
        <TouchableOpacity 
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
          className="flex-row justify-center gap-4 mb-10"
        >
          {[0, 1, 2, 3].map((index) => {
            const digit = code[index] || '';
            const isFocused = code.length === index;
            const isFilled = digit !== '';
            return (
              <View
                key={index}
                className="w-16 h-16 rounded-2xl items-center justify-center border-2"
                style={{
                  backgroundColor: activeColors.surface,
                  borderColor: isFocused ? tokens.colors.light.brand : (isFilled ? activeColors.text.primary : activeColors.border),
                  ...tokens.elevation[isDark ? 'dark' : 'light'].card
                }}
              >
                <Text 
                  className="font-bold text-center" 
                  style={{ 
                    color: activeColors.text.primary, 
                    fontSize: tokens.typography.size['2xl'] 
                  }}
                >
                  {digit}
                </Text>
              </View>
            );
          })}
        </TouchableOpacity>

        {/* Hidden TextInput for driving keyboard input */}
        <TextInput
          ref={inputRef}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
          keyboardType="number-pad"
          maxLength={4}
          value={code}
          onChangeText={setCode}
          autoFocus
        />

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleVerify}
          disabled={isLoading || code.length < 4}
          className="w-full items-center justify-center rounded-xl py-4"
          style={{ 
            backgroundColor: tokens.colors.light.brand, 
            opacity: (isLoading || code.length < 4) ? 0.6 : 1,
            ...tokens.elevation[isDark ? 'dark' : 'light'].card
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: tokens.typography.size.lg, fontWeight: '600' }}>
            {isLoading ? 'Verifying...' : 'Verify & Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
