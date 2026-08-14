import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ThemeToggle } from '../../theme/ThemeToggle';
import { Avatar } from '../../components/Avatar';
import { Header } from '../../components/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, LogOut, ShieldCheck, ShieldAlert, Settings as SettingsIcon } from 'lucide-react-native';
import { useToast } from '../../components/Toast';

export default function SettingsScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  // Mock data for Stage B
  const user = {
    name: 'Shadrach Aroni',
    phone: '+254 712 345 678',
    isVerified: true,
    isAdmin: true,
  };

  const handleLogout = () => {
    showToast('Logged out successfully', 'success');
  };

  const handleAdminAccess = () => {
    showToast('Navigating to Admin stack...', 'info');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Settings" showBack={false} />
      
      <ScrollView 
        contentContainerStyle={{ 
          padding: tokens.spacing.lg,
          paddingBottom: insets.bottom + tokens.spacing.xl
        }}
      >
        {/* Profile Card */}
        <View 
          className="rounded-xl p-4 mb-6"
          style={{ 
            backgroundColor: activeColors.surface,
            ...tokens.elevation[isDark ? 'dark' : 'light'].card
          }}
        >
          <View className="flex-row items-center mb-4">
            <Avatar name={user.name} size={60} />
            <View className="ml-4 flex-1">
              <Text 
                className="font-bold mb-1" 
                style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}
              >
                {user.name}
              </Text>
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                {user.phone}
              </Text>
            </View>
          </View>
          
          <View 
            className="flex-row items-center pt-3 mt-1" 
            style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: activeColors.border }}
          >
            {user.isVerified ? (
              <>
                <ShieldCheck size={18} color={tokens.colors.semantic.success} />
                <Text className="ml-2 font-medium" style={{ color: tokens.colors.semantic.success, fontSize: tokens.typography.size.sm }}>
                  Identity Verified
                </Text>
              </>
            ) : (
              <>
                <ShieldAlert size={18} color={tokens.colors.semantic.warning} />
                <Text className="ml-2 font-medium" style={{ color: tokens.colors.semantic.warning, fontSize: tokens.typography.size.sm }}>
                  Verification Pending
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Theme Settings */}
        <View className="mb-6">
          <Text 
            className="font-semibold mb-3 ml-1"
            style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}
          >
            APPEARANCE
          </Text>
          <View 
            className="rounded-xl overflow-hidden"
            style={{ 
              backgroundColor: activeColors.surface,
              ...tokens.elevation[isDark ? 'dark' : 'light'].card
            }}
          >
            <View className="p-4 flex-row items-center justify-between">
              <Text className="font-medium" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                Theme
              </Text>
              <View className="w-1/2">
                <ThemeToggle />
              </View>
            </View>
          </View>
        </View>

        {/* Admin Section (Conditional) */}
        {user.isAdmin && (
          <View className="mb-6">
            <Text 
              className="font-semibold mb-3 ml-1"
              style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}
            >
              ADMINISTRATION
            </Text>
            <View 
              className="rounded-xl overflow-hidden"
              style={{ 
                backgroundColor: activeColors.surface,
                ...tokens.elevation[isDark ? 'dark' : 'light'].card
              }}
            >
              <TouchableOpacity 
                className="p-4 flex-row items-center justify-between"
                onPress={handleAdminAccess}
              >
                <View className="flex-row items-center">
                  <SettingsIcon size={20} color={activeColors.text.primary} />
                  <Text className="ml-3 font-medium" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                    Admin Console
                  </Text>
                </View>
                <ChevronRight size={20} color={activeColors.text.muted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions */}
        <View className="mt-4">
          <TouchableOpacity 
            className="flex-row items-center justify-center p-4 rounded-xl"
            style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2' }}
            onPress={handleLogout}
          >
            <LogOut size={20} color={tokens.colors.semantic.error} />
            <Text 
              className="ml-2 font-semibold" 
              style={{ color: tokens.colors.semantic.error, fontSize: tokens.typography.size.base }}
            >
              Log Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="mt-10 items-center">
          <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs }}>
            UniPay v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
