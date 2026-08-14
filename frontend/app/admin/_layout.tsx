import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { ShieldAlert, ArrowLeft } from 'lucide-react-native';

// BACKEND TODO: this is UX only. The API must independently return 403 for any admin endpoint if the JWT's role claim isn't super_admin/support/compliance_reviewer. Client-side role checks are never sufficient access control.

function AccessDenied() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: activeColors.background }}>
      <View className="w-16 h-16 rounded-full items-center justify-center mb-4 bg-red-100 dark:bg-red-950">
        <ShieldAlert size={32} color={tokens.colors.semantic.error} />
      </View>
      <Text className="font-bold text-center mb-2" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.xl }}>
        Access Denied
      </Text>
      <Text className="text-center mb-6 px-4" style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.base }}>
        You do not have administrative privileges to access this area.
      </Text>
      <TouchableOpacity 
        onPress={() => router.replace('/(tabs)')}
        className="px-6 py-3 rounded-xl flex-row items-center"
        style={{ backgroundColor: tokens.colors.light.brand }}
      >
        <ArrowLeft size={18} color="#ffffff" />
        <Text className="font-semibold text-white ml-2">Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminLayout() {
  const user = useAuth();

  if (!user.isAdmin) {
    return <AccessDenied />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
