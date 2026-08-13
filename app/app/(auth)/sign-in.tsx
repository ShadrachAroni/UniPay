import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

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
    <ScrollView className="flex-1 bg-slate-900 px-6 py-12">
      <View className="max-w-md mx-auto w-full">
        <Text className="text-2xl font-bold text-white mb-2">Welcome to UniPay</Text>
        <Text className="text-slate-400 text-sm mb-6">
          Sign in to your individual or business account
        </Text>

        {errorMsg && (
          <View className="bg-rose-950/60 border border-rose-800 p-3 rounded-lg mb-4">
            <Text className="text-rose-400 text-xs">{errorMsg}</Text>
          </View>
        )}

        <View className="space-y-4">
          <View>
            <Text className="text-slate-300 text-xs font-semibold mb-1">Email</Text>
            <TextInput
              autoCapitalize="none"
              value={emailAddress}
              placeholder="name@example.com"
              placeholderTextColor="#64748B"
              onChangeText={setEmailAddress}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg p-3 text-sm"
            />
          </View>

          <View className="mt-3">
            <Text className="text-slate-300 text-xs font-semibold mb-1">Password</Text>
            <TextInput
              value={password}
              placeholder="Enter password"
              placeholderTextColor="#64748B"
              secureTextEntry
              onChangeText={setPassword}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg p-3 text-sm"
            />
          </View>

          <TouchableOpacity
            onPress={onSignInPress}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 py-3 rounded-lg items-center mt-6"
          >
            <Text className="text-white font-bold text-sm">
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/sign-up')}
            className="py-3 items-center mt-2"
          >
            <Text className="text-slate-400 text-xs">
              Don't have an account? <Text className="text-blue-400 font-semibold">Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
