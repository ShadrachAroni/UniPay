import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/ui/Header';
import { ThemeToggle } from '../../theme/ThemeToggle';

export default function SettingsScreen() {
  const { tokens, activeColors } = useTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Settings" showBack={false} />
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
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
              fontSize: tokens.typography.size.base,
            }}
          >
            Appearance
          </Text>
          <Text
            className="mb-3"
            style={{
              color: activeColors.text.secondary,
              fontSize: tokens.typography.size.sm,
            }}
          >
            Choose your preferred app theme.
          </Text>
          <ThemeToggle />
        </View>
      </ScrollView>
    </View>
  );
}
