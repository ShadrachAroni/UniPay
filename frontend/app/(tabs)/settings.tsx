import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ThemeToggle } from '../../theme/ThemeToggle';
import { Avatar } from '../../components/Avatar';
import { Header } from '../../components/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, LogOut, ShieldCheck, ShieldAlert, Settings as SettingsIcon, UserCheck, Building2, Shield } from 'lucide-react-native';
import { useToast } from '../../components/Toast';
import { router } from 'expo-router';
import { useAuth, MOCK_PROFILES } from '../../components/AuthProvider';

export default function SettingsScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { profile, isAdmin, setMockProfile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
    showToast('Logged out successfully', 'success');
  };

  const handleAdminAccess = () => {
    router.push('/admin');
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
            <Avatar 
              name={profile?.account_type === 'business' ? (profile?.business_name || profile?.display_name || 'Business') : (profile?.owner_name || profile?.display_name || 'User')} 
              size={60} 
            />
            <View className="ml-4 flex-1">
              {/* Name Display: Business primary + owner secondary OR Individual owner only */}
              {profile?.account_type === 'business' ? (
                <>
                  <Text 
                    className="font-bold mb-0.5" 
                    style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}
                  >
                    {profile.business_name || profile.display_name}
                  </Text>
                  <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 4 }}>
                    Owner: {profile.owner_name}
                  </Text>
                </>
              ) : (
                <Text 
                  className="font-bold mb-1" 
                  style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}
                >
                  {profile?.owner_name || profile?.display_name || 'User'}
                </Text>
              )}

              {/* Account Type & Admin Role Labels as Literal Text */}
              <View className="flex-row flex-wrap items-center gap-2 mt-1">
                <Text className="text-xs font-semibold" style={{ color: tokens.colors.light.brand }}>
                  {profile?.account_type === 'business' ? 'Business account' : 'Individual account'}
                </Text>

                {profile?.admin_role && (
                  <Text className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                    • Admin: {profile.admin_role.replace('_', ' ')}
                  </Text>
                )}
              </View>
            </View>
          </View>
          
          <View 
            className="flex-row items-center pt-3 mt-1" 
            style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: activeColors.border }}
          >
            {profile?.verification_status === 'verified' ? (
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

        {/* Admin Section (Only rendered if user.isAdmin === true) */}
        {isAdmin && (
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

        {/* Dev Tools Role Switcher Section */}
        <View className="mb-6">
          <Text 
            className="font-semibold mb-3 ml-1"
            style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}
          >
            DEV TOOLS (MOCK ROLE SWITCHER)
          </Text>
          <View 
            className="rounded-xl p-4 border border-dashed"
            style={{ 
              backgroundColor: activeColors.surface,
              borderColor: tokens.colors.light.brand + '60'
            }}
          >
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 12 }}>
              Switch profile state to test role-based UI gating:
            </Text>

            {MOCK_PROFILES.map((mockP) => {
              const isCurrent = profile?.id === mockP.id;
              return (
                <TouchableOpacity
                  key={mockP.id}
                  onPress={() => {
                    setMockProfile(mockP);
                    showToast(`Switched to ${mockP.display_name}`, 'success');
                  }}
                  className={`p-3 rounded-lg flex-row items-center justify-between mb-2 ${
                    isCurrent ? 'bg-blue-50 dark:bg-blue-950 border border-blue-400' : 'bg-transparent'
                  }`}
                >
                  <View className="flex-row items-center flex-1">
                    {mockP.admin_role ? (
                      <Shield size={18} color={tokens.colors.light.brand} />
                    ) : mockP.account_type === 'business' ? (
                      <Building2 size={18} color={activeColors.text.primary} />
                    ) : (
                      <UserCheck size={18} color={activeColors.text.secondary} />
                    )}
                    <Text 
                      className="ml-3 font-medium text-xs flex-1"
                      style={{ color: isCurrent ? tokens.colors.light.brand : activeColors.text.primary }}
                    >
                      {mockP.display_name}
                    </Text>
                  </View>
                  {isCurrent && (
                    <Text className="text-xs font-bold text-blue-600 dark:text-blue-400 ml-2">ACTIVE</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Actions */}
        <View className="mt-2">
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
        <View className="mt-8 items-center">
          <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs }}>
            UniPay v1.0.0 (Stage B Auth Context)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
