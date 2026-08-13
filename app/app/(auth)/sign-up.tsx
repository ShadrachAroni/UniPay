import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

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
    <ScrollView className="flex-1 bg-slate-900 px-6 py-12">
      <View className="max-w-md mx-auto w-full">
        <Text className="text-2xl font-bold text-white mb-2">Create an Account</Text>
        <Text className="text-slate-400 text-sm mb-6">
          One unified identity for payments across Kenya
        </Text>

        {errorMsg && (
          <View className="bg-rose-950/60 border border-rose-800 p-3 rounded-lg mb-4">
            <Text className="text-rose-400 text-xs">{errorMsg}</Text>
          </View>
        )}

        {!pendingVerification ? (
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
                placeholder="Choose secure password"
                placeholderTextColor="#64748B"
                secureTextEntry
                onChangeText={setPassword}
                className="bg-slate-800 border border-slate-700 text-white rounded-lg p-3 text-sm"
              />
            </View>

            <TouchableOpacity
              onPress={onSignUpPress}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 py-3 rounded-lg items-center mt-6"
            >
              <Text className="text-white font-bold text-sm">
                {loading ? 'Creating Account...' : 'Continue'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(auth)/sign-in')}
              className="py-3 items-center mt-2"
            >
              <Text className="text-slate-400 text-xs">
                Already registered? <Text className="text-blue-400 font-semibold">Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="space-y-4">
            <Text className="text-slate-300 text-xs font-semibold mb-1">
              Enter Verification Code sent to {emailAddress}
            </Text>
            <TextInput
              value={code}
              placeholder="123456"
              placeholderTextColor="#64748B"
              onChangeText={setCode}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg p-3 text-sm text-center tracking-widest font-mono text-lg"
            />
            <TouchableOpacity
              onPress={onPressVerify}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg items-center mt-6"
            >
              <Text className="text-white font-bold text-sm">
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
