import React from 'react';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { Header } from '../../components/ui/Header';
import { useTheme } from '../../theme/ThemeProvider';

export default function TabsHomeRedirect() {
  const { tokens, activeColors } = useTheme();
  const router = useRouter();

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Home" showBack={false} />

      <View className="px-5 py-6">
        <View
          className="rounded-xl p-4"
          style={{
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
            borderWidth: 1,
          }}
        >
          <Text
            className="font-semibold mb-2"
            style={{
              color: activeColors.text.primary,
              fontSize: tokens.typography.size.lg,
            }}
          >
            Quick Navigation
          </Text>
          <Text
            style={{
              color: activeColors.text.secondary,
              fontSize: tokens.typography.size.sm,
              marginBottom: 14,
            }}
          >
            Open core UniPay surfaces from one place.
          </Text>

          <View className="gap-2">
            <TouchableOpacity
              className="rounded-lg px-3 py-3"
              style={{ backgroundColor: activeColors.brand }}
              onPress={() => router.push('/')}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Open Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-lg px-3 py-3"
              style={{ backgroundColor: activeColors.surfaceHover }}
              onPress={() => router.push('/(tabs)/transactions')}
            >
              <Text style={{ color: activeColors.text.primary, fontWeight: '600' }}>
                Open Transactions
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
