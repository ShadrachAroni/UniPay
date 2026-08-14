import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { ThemeToggle } from '../../theme/ThemeToggle';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import { ShieldCheck, AlertCircle, LogIn } from 'lucide-react-native';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const { tokens, isDark, activeColors } = useTheme();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSignInPress = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      });

      await setActive({ session: completeSignIn.createdSessionId });
      router.replace('/');
    } catch (err: any) {
      setErrorMsg(err.errors?.[0]?.message || 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Sign In" showBack onBack={() => router.replace('/')} />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: tokens.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-md">
          {/* Logo & Header */}
          <View className="items-center mb-6">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center mb-3"
              style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe' }}
            >
              <ShieldCheck size={28} color={activeColors.brand} />
            </View>
            <Text className="font-bold text-2xl" style={{ color: activeColors.text.primary }}>
              Welcome to UniPay
            </Text>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
              Sign in to your universal Kenyan payment account
            </Text>
          </View>

          {/* Theme Switcher */}
          <View className="mb-6">
            <ThemeToggle />
          </View>

          <Card variant="elevated">
            {errorMsg && (
              <View
                className="p-3.5 rounded-xl mb-4 flex-row items-center border"
                style={{
                  backgroundColor: tokens.colors.semantic.errorBg,
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
                }}
              >
                <AlertCircle size={16} color={tokens.colors.semantic.error} />
                <Text className="ml-2 font-medium flex-1 text-xs" style={{ color: tokens.colors.semantic.error }}>
                  {errorMsg}
                </Text>
              </View>
            )}

            <View className="gap-3">
              <Input
                label="Email Address"
                autoCapitalize="none"
                value={emailAddress}
                placeholder="name@example.com"
                keyboardType="email-address"
                onChangeText={setEmailAddress}
                icon="user"
              />

              <Input
                label="Password"
                value={password}
                placeholder="Enter your password"
                secureTextEntry
                onChangeText={setPassword}
                icon="lock"
              />

              <Button
                title={loading ? 'Signing In...' : 'Sign In'}
                onPress={onSignInPress}
                loading={loading}
                variant="primary"
                size="lg"
                icon="arrow-right"
                iconPosition="right"
                style={{ marginTop: 8 }}
              />

              <TouchableOpacity
                onPress={() => router.push('/(auth)/sign-up')}
                className="py-3 items-center mt-2"
              >
                <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                  Don't have an account?{' '}
                  <Text className="font-bold" style={{ color: activeColors.brand }}>
                    Sign Up
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
