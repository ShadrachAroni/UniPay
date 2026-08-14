import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { ThemeToggle } from '../../theme/ThemeToggle';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react-native';

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const { tokens, isDark, activeColors } = useTheme();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      await signUp.create({
        emailAddress,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      setErrorMsg(err.errors?.[0]?.message || 'Sign up failed. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      await setActive({ session: completeSignUp.createdSessionId });
      router.replace('/');
    } catch (err: any) {
      setErrorMsg(err.errors?.[0]?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Sign Up" showBack onBack={() => router.replace('/')} />

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
              Create an Account
            </Text>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
              One unified identity for payments across Kenya
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

            {!pendingVerification ? (
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
                  placeholder="Choose a secure password"
                  secureTextEntry
                  onChangeText={setPassword}
                  icon="lock"
                />

                <Button
                  title={loading ? 'Creating Account...' : 'Continue'}
                  onPress={onSignUpPress}
                  loading={loading}
                  variant="primary"
                  size="lg"
                  icon="arrow-right"
                  iconPosition="right"
                  style={{ marginTop: 8 }}
                />

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/sign-in')}
                  className="py-3 items-center mt-2"
                >
                  <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                    Already have an account?{' '}
                    <Text className="font-bold" style={{ color: activeColors.brand }}>
                      Sign In
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-3">
                <View className="items-center mb-2">
                  <CheckCircle2 size={32} color={tokens.colors.semantic.success} />
                  <Text className="font-bold text-base mt-2" style={{ color: activeColors.text.primary }}>
                    Verification Code Sent
                  </Text>
                  <Text className="text-center text-xs mt-1" style={{ color: activeColors.text.secondary }}>
                    We sent a 6-digit code to {emailAddress}
                  </Text>
                </View>

                <Input
                  value={code}
                  placeholder="123456"
                  keyboardType="numeric"
                  onChangeText={setCode}
                  style={{ textAlign: 'center', letterSpacing: 6, fontFamily: 'monospace', fontSize: 20 }}
                />

                <Button
                  title={loading ? 'Verifying...' : 'Verify & Continue'}
                  onPress={onPressVerify}
                  loading={loading}
                  variant="primary"
                  size="lg"
                  style={{ marginTop: 8 }}
                />
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
