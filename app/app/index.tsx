import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function IndexScreen() {
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [healthStatus, setHealthStatus] = useState<{
    loading: boolean;
    data: any;
    error: string | null;
  }>({
    loading: true,
    data: null,
    error: null,
  });

  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

  const checkHealth = async () => {
    setHealthStatus({ loading: true, data: null, error: null });
    try {
      const res = await fetch(`${apiUrl}/health`);
      const json = await res.json();
      setHealthStatus({ loading: false, data: json, error: null });
    } catch (err: any) {
      setHealthStatus({
        loading: false,
        data: null,
        error: err?.message || 'Failed to reach backend',
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <ScrollView className="flex-1 bg-slate-900 px-4 py-8">
      <View className="max-w-2xl mx-auto w-full">
        {/* Header Badge */}
        <View className="items-center mb-6">
          <View className="bg-blue-600/20 border border-blue-500/30 px-3 py-1 rounded-full mb-3">
            <Text className="text-blue-400 font-semibold text-xs tracking-wider uppercase">
              Phase 0 — Foundations & Scaffolding
            </Text>
          </View>
          <Text className="text-3xl font-extrabold text-white text-center">
            UniPay Kenya
          </Text>
          <Text className="text-slate-400 text-sm mt-1 text-center">
            Unified Payment, Identity & Reconciliation Platform (LOOP / M-Pesa / PesaLink)
          </Text>
        </View>

        {/* Platform Info Card */}
        <View className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 mb-4 shadow-sm">
          <Text className="text-slate-300 font-bold text-base mb-2">
            Target Surface & Architecture
          </Text>
          <View className="flex-row items-center justify-between py-2 border-b border-slate-700/50">
            <Text className="text-slate-400 text-sm">Active Platform:</Text>
            <View className="bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded">
              <Text className="text-emerald-400 font-mono text-xs uppercase font-bold">
                {Platform.OS} ({Platform.select({ web: 'Browser Export', ios: 'Native iOS', android: 'Native Android' })})
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between py-2 border-b border-slate-700/50">
            <Text className="text-slate-400 text-sm">Web Checkout Guarantee:</Text>
            <Text className="text-slate-300 text-xs font-mono">Zero-install static web export</Text>
          </View>
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-slate-400 text-sm">Design System:</Text>
            <Text className="text-slate-300 text-xs font-mono">NativeWind / Tailwind</Text>
          </View>
        </View>

        {/* Backend Health Check Card */}
        <View className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 mb-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-slate-300 font-bold text-base">
              Backend Health Check
            </Text>
            <TouchableOpacity
              onPress={checkHealth}
              className="bg-slate-700 px-2.5 py-1 rounded border border-slate-600"
            >
              <Text className="text-xs text-slate-200">Refresh</Text>
            </TouchableOpacity>
          </View>

          {healthStatus.loading ? (
            <View className="py-4 items-center">
              <ActivityIndicator color="#3B82F6" />
              <Text className="text-slate-400 text-xs mt-2">Pinging {apiUrl}/health...</Text>
            </View>
          ) : healthStatus.error ? (
            <View className="bg-rose-950/40 border border-rose-800/50 rounded-lg p-3">
              <Text className="text-rose-400 font-semibold text-xs mb-1">
                Backend Unreachable
              </Text>
              <Text className="text-slate-400 text-xs font-mono">
                {healthStatus.error}
              </Text>
              <Text className="text-slate-500 text-xs mt-2">
                Make sure backend server is running on port 4000
              </Text>
            </View>
          ) : (
            <View className="space-y-2">
              <View className="flex-row items-center justify-between py-1 border-b border-slate-700/50">
                <Text className="text-slate-400 text-xs">System Status:</Text>
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                  <Text className="text-emerald-400 font-bold text-xs">
                    {healthStatus.data?.status?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between py-1 border-b border-slate-700/50">
                <Text className="text-slate-400 text-xs">PostgreSQL DB:</Text>
                <Text className="text-emerald-400 font-mono text-xs">
                  {healthStatus.data?.db === 'ok' ? 'Connected (Pool active)' : 'Error'}
                </Text>
              </View>
              <View className="flex-row items-center justify-between py-1">
                <Text className="text-slate-400 text-xs">API Version:</Text>
                <Text className="text-slate-300 font-mono text-xs">
                  {healthStatus.data?.version}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Clerk Auth Scaffolding Card */}
        <View className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 mb-4 shadow-sm">
          <Text className="text-slate-300 font-bold text-base mb-3">
            Clerk Authentication Scaffolding
          </Text>
          {isSignedIn ? (
            <View>
              <View className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50 mb-3">
                <Text className="text-slate-300 text-xs font-semibold">
                  Signed in as:
                </Text>
                <Text className="text-blue-400 font-mono text-xs mt-1">
                  {user?.primaryEmailAddress?.emailAddress || user?.id || 'Authenticated User'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => signOut()}
                className="bg-rose-600/80 hover:bg-rose-600 py-2.5 rounded-lg items-center"
              >
                <Text className="text-white font-semibold text-sm">Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text className="text-slate-400 text-xs mb-3">
                Universal Clerk authentication is wired for all export targets.
              </Text>
              <View className="flex-row space-x-3">
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/sign-in')}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg items-center mr-2"
                >
                  <Text className="text-white font-semibold text-sm">Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/sign-up')}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg items-center"
                >
                  <Text className="text-slate-200 font-semibold text-sm">Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* API Stubs Status Summary */}
        <View className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 mb-8 shadow-sm">
          <Text className="text-slate-300 font-bold text-base mb-2">
            API-First Contract Coverage
          </Text>
          <Text className="text-slate-400 text-xs mb-3">
            All 27 §18 core endpoints and 7 Phase 4B extensions are stubbed with 501 handlers to unblock frontend and mobile teams.
          </Text>
          <View className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50">
            <Text className="text-slate-400 font-mono text-xs">
              ✓ Profiles & Aliases (Phase 1)
            </Text>
            <Text className="text-slate-400 font-mono text-xs mt-1">
              ✓ LOOP & M-Pesa Rails (Phase 2)
            </Text>
            <Text className="text-slate-400 font-mono text-xs mt-1">
              ✓ Reconciliation & CSV Exports (Phase 3)
            </Text>
            <Text className="text-slate-400 font-mono text-xs mt-1">
              ✓ Balances, Money Direction & Payouts (Phase 4)
            </Text>
            <Text className="text-slate-400 font-mono text-xs mt-1">
              ✓ Expected & Pooled Payments (Phase 4B)
            </Text>
            <Text className="text-slate-400 font-mono text-xs mt-1">
              ✓ AI Assistant & Query Engine (Phase 5)
            </Text>
            <Text className="text-slate-400 font-mono text-xs mt-1">
              ✓ Admin Operations & Audit Logs (Phase 6)
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
