import React from 'react';
import { Stack } from 'expo-router';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { ToastProvider } from '../components/ui/Toast';
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

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable.');
}

function NavigationStack() {
  const { isDark, tokens } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: activeColors.surface },
          headerTintColor: activeColors.text.primary,
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: activeColors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'UniPay Dashboard',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="pay/[alias]"
          options={{
            title: 'UniPay Checkout',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="[alias]"
          options={{
            title: 'UniPay Checkout',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            title: 'UniPay Admin Console',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{
            title: 'Transaction Details',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="payouts"
          options={{
            title: 'Payouts',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="money-direction"
          options={{
            title: 'Money Direction',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="pools"
          options={{
            title: 'Payment Pools',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="expected-payments"
          options={{
            title: 'Expected Payments',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="checkout"
          options={{
            title: 'Checkout',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(auth)/sign-in"
          options={{
            title: 'Sign In',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(auth)/sign-up"
          options={{
            title: 'Sign Up',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        <ThemeProvider>
          <ToastProvider>
            <NavigationStack />
          </ToastProvider>
        </ThemeProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
