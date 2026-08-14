import React from 'react';
import { Tabs } from 'expo-router';
import { Home, ArrowLeftRight, Settings } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';

export default function TabsLayout() {
  const { tokens, activeColors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: activeColors.surface,
          borderTopColor: activeColors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: activeColors.brand,
        tabBarInactiveTintColor: activeColors.text.muted,
        tabBarLabelStyle: {
          fontSize: tokens.typography.size.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => (
            <ArrowLeftRight color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
