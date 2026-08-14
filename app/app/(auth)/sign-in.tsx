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
import { useDemoAuth, DEMO_PERSONAS, DemoPersona } from '../../context/DemoAuthContext';
import { useToast } from '../../components/ui/Toast';
import {
  ShieldCheck,
  AlertCircle,
  LogIn,
  Sparkles,
  Building2,
  User,
  Shield,
  Zap,
  ArrowRight,
} from 'lucide-react-native';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { switchPersona, currentPersona } = useDemoAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const { tokens, isDark, activeColors } = useTheme();

  const [activeTab, setActiveTab] = useState<'demo' | 'clerk'>('demo');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDemoSignIn = async (persona: DemoPersona) => {
    setLoading(true);
    try {
      await switchPersona(persona.id);
      showToast(`Logged in as ${persona.name} (${persona.badge})`, 'success');
      if (persona.isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to activate demo persona');
    } finally {
      setLoading(false);
    }
  };

  const onSignInPress = async () => {
    setLoading(true);
    setErrorMsg(null);

    const cleanInput = emailAddress.trim().toLowerCase();

    // Check if input matches any demo persona by email, id, or alias
    const matchingDemo = DEMO_PERSONAS.find(
      (p) =>
        p.email.toLowerCase() === cleanInput ||
        p.id.toLowerCase() === cleanInput ||
        p.alias.toLowerCase() === cleanInput ||
        p.alias.toLowerCase().replace('@', '') === cleanInput
    );

    if (matchingDemo) {
      await handleDemoSignIn(matchingDemo);
      return;
    }

    if (!isLoaded) {
      setLoading(false);
      return;
    }

    try {
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      });

      await setActive({ session: completeSignIn.createdSessionId });
      showToast('Signed in successfully!', 'success');
      router.replace('/');
    } catch (err: any) {
      setErrorMsg(
        err.errors?.[0]?.message ||
          'Sign in failed. For demo testing, switch to the "1-Click Demo Login" tab or select a persona.'
      );
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
            <Text
              style={{
                color: activeColors.text.secondary,
                fontSize: tokens.typography.size.sm,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              Universal Payment, Identity & Reconciliation for Kenya
            </Text>
          </View>

          {/* Theme Switcher */}
          <View className="mb-4">
            <ThemeToggle />
          </View>

          {/* Tab Switcher: Demo Login vs Clerk Custom Account */}
          <View
            className="flex-row p-1 rounded-2xl border mb-5"
            style={{
              backgroundColor: activeColors.surfaceSubtle,
              borderColor: activeColors.border,
            }}
          >
            <TouchableOpacity
              onPress={() => setActiveTab('demo')}
              activeOpacity={0.8}
              className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
              style={{
                backgroundColor:
                  activeTab === 'demo'
                    ? isDark
                      ? tokens.colors.dark.surface
                      : '#ffffff'
                    : 'transparent',
                borderColor: activeTab === 'demo' ? activeColors.border : 'transparent',
                borderWidth: activeTab === 'demo' ? 1 : 0,
              }}
            >
              <Sparkles
                size={15}
                color={activeTab === 'demo' ? activeColors.brand : activeColors.text.muted}
              />
              <Text
                className="font-bold text-xs"
                style={{
                  color: activeTab === 'demo' ? activeColors.brand : activeColors.text.secondary,
                }}
              >
                1-Click Demo Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('clerk')}
              activeOpacity={0.8}
              className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
              style={{
                backgroundColor:
                  activeTab === 'clerk'
                    ? isDark
                      ? tokens.colors.dark.surface
                      : '#ffffff'
                    : 'transparent',
                borderColor: activeTab === 'clerk' ? activeColors.border : 'transparent',
                borderWidth: activeTab === 'clerk' ? 1 : 0,
              }}
            >
              <User
                size={15}
                color={activeTab === 'clerk' ? activeColors.brand : activeColors.text.muted}
              />
              <Text
                className="font-bold text-xs"
                style={{
                  color: activeTab === 'clerk' ? activeColors.brand : activeColors.text.secondary,
                }}
              >
                Email / Password
              </Text>
            </TouchableOpacity>
          </View>

          {/* 1. 1-CLICK DEMO LOGIN TAB */}
          {activeTab === 'demo' && (
            <Card variant="elevated" className="mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Zap size={18} color={activeColors.brand} />
                  <Text
                    className="font-bold text-sm ml-2"
                    style={{ color: activeColors.text.primary }}
                  >
                    Select a Pre-Configured Persona
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  color: activeColors.text.secondary,
                  fontSize: tokens.typography.size.xs,
                  marginBottom: 14,
                }}
              >
                Choose any seeded persona to test live payment workflows, split settlement, and admin triage instantly:
              </Text>

              <View className="gap-2.5">
                {DEMO_PERSONAS.map((persona) => (
                  <TouchableOpacity
                    key={persona.id}
                    onPress={() => handleDemoSignIn(persona)}
                    activeOpacity={0.7}
                    className="p-3.5 rounded-2xl border flex-row items-center justify-between"
                    style={{
                      backgroundColor:
                        currentPersona.id === persona.id
                          ? isDark
                            ? 'rgba(59, 130, 246, 0.15)'
                            : '#eff6ff'
                          : activeColors.surfaceSubtle,
                      borderColor:
                        currentPersona.id === persona.id
                          ? activeColors.brand
                          : activeColors.borderSubtle,
                    }}
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: persona.avatarColor }}
                      >
                        {persona.isAdmin ? (
                          <Shield size={20} color="#ffffff" />
                        ) : persona.role === 'business' ? (
                          <Building2 size={20} color="#ffffff" />
                        ) : (
                          <User size={20} color="#ffffff" />
                        )}
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5">
                          <Text
                            className="font-bold text-sm"
                            style={{ color: activeColors.text.primary }}
                          >
                            {persona.name}
                          </Text>
                          <Text
                            className="font-mono text-xs font-semibold"
                            style={{ color: activeColors.brand }}
                          >
                            {persona.alias}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: activeColors.text.secondary,
                            fontSize: 11,
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                        >
                          {persona.description}
                        </Text>
                      </View>
                    </View>

                    <View
                      className="px-3 py-1.5 rounded-xl border flex-row items-center"
                      style={{
                        backgroundColor: activeColors.brand,
                        borderColor: activeColors.brand,
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                        Login
                      </Text>
                      <ArrowRight size={12} color="#ffffff" style={{ marginLeft: 4 }} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          )}

          {/* 2. CLERK EMAIL / PASSWORD TAB */}
          {activeTab === 'clerk' && (
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
                  <Text
                    className="ml-2 font-medium flex-1 text-xs"
                    style={{ color: tokens.colors.semantic.error }}
                  >
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
                  title={loading ? 'Signing In...' : 'Sign In with Clerk'}
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
                  <Text
                    style={{
                      color: activeColors.text.secondary,
                      fontSize: tokens.typography.size.sm,
                    }}
                  >
                    Don't have an account?{' '}
                    <Text className="font-bold" style={{ color: activeColors.brand }}>
                      Sign Up
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
