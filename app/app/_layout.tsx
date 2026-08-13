import React from 'react';
import { Stack } from 'expo-router';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

const tokenCache = {
  async getToken(key: string) {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      return SecureStore.setItemAsync(key, value);
    } catch {
      return;
    }
  },
};

const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  'pk_test_placeholder_unipay_phase0';

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0F172A' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: '#0F172A' },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'UniPay — Phase 0',
              headerShown: true,
            }}
          />
          <Stack.Screen
            name="(auth)/sign-in"
            options={{
              title: 'Sign In',
              headerShown: true,
            }}
          />
          <Stack.Screen
            name="(auth)/sign-up"
            options={{
              title: 'Sign Up',
              headerShown: true,
            }}
          />
        </Stack>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
