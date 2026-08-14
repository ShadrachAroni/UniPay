import { Tabs } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Settings, Home, ArrowRightLeft } from 'lucide-react-native';

export default function TabLayout() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: activeColors.surface,
          borderTopColor: activeColors.border,
        },
        tabBarActiveTintColor: activeColors.brand,
        tabBarInactiveTintColor: activeColors.text.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => <ArrowRightLeft color={color} size={size} />,
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
