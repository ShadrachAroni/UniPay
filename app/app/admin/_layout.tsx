import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useDemoAuth } from '../../context/DemoAuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { ThemeToggle } from '../../theme/ThemeToggle';
import {
  Zap,
  Shield,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react-native';

interface NavItem {
  name: string;
  route: string;
  icon: any;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'overview', route: '/admin', icon: Zap, label: 'Overview' },
  { name: 'users', route: '/admin/users', icon: Shield, label: 'Users & KYC' },
  { name: 'exceptions', route: '/admin/exceptions', icon: AlertTriangle, label: 'Exceptions' },
  { name: 'rails', route: '/admin/rails', icon: CreditCard, label: 'Payment Rails' },
  { name: 'payouts', route: '/admin/payouts', icon: ArrowRight, label: 'Payouts & Disputes' },
  { name: 'audit', route: '/admin/audit', icon: CheckCircle2, label: 'Audit Logs' },
];

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const { tokens, isDark, activeColors } = useTheme();
  const [adminRole, setAdminRole] = useState<'super_admin' | 'support' | 'compliance_reviewer' | null>(null);
  const { apiUrl, getAuthHeaders } = useAdminApi();

  const { isDemoMode, currentPersona } = useDemoAuth();

  useEffect(() => {
    let isMounted = true;

    const fetchAdminContext = async () => {
      if (!apiUrl) {
        if (isMounted) setAdminRole(null);
        return;
      }

      // In clerk mode wait for isLoaded, but in demo mode proceed
      if (!isDemoMode && (!isLoaded || !isSignedIn)) {
        if (isMounted) setAdminRole(null);
        return;
      }

      try {
        const res = await fetch(`${apiUrl}/api/v1/admin/me`, {
          headers: await getAuthHeaders(),
        });

        if (!res.ok) {
          // Fallback to super_admin in demo mode
          if (isMounted) setAdminRole(isDemoMode ? 'super_admin' : null);
          return;
        }

        const data = await res.json();
        const role = data?.admin_user?.role;

        if (role === 'super_admin' || role === 'support' || role === 'compliance_reviewer') {
          if (isMounted) setAdminRole(role);
        } else {
          if (isMounted) setAdminRole(isDemoMode ? 'super_admin' : null);
        }
      } catch {
        if (isMounted) setAdminRole(isDemoMode ? 'super_admin' : null);
      }
    };

    fetchAdminContext();

    return () => {
      isMounted = false;
    };
  }, [apiUrl, isSignedIn, isLoaded, isDemoMode, currentPersona?.id]);

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      {/* Admin Top Header Banner */}
      <View
        className="flex-row items-center justify-between px-5 py-3.5 border-b"
        style={{
          backgroundColor: activeColors.surface,
          borderColor: activeColors.border,
        }}
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.push('/')}
            className="p-1.5 rounded-lg border mr-1 flex-row items-center"
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              borderColor: activeColors.border,
            }}
          >
            <ChevronLeft size={16} color={activeColors.text.primary} />
            <Text className="text-xs font-semibold ml-1" style={{ color: activeColors.text.primary }}>
              App
            </Text>
          </TouchableOpacity>

          <View
            className="px-2 py-0.5 rounded border"
            style={{
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#93c5fd',
            }}
          >
            <Text className="text-xs font-bold tracking-wider uppercase" style={{ color: activeColors.brand }}>
              OPERATIONS
            </Text>
          </View>

          <Text className="font-bold text-base" style={{ color: activeColors.text.primary }}>
            UniPay Admin Console
          </Text>

          <View
            className="px-2 py-0.5 rounded"
            style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
          >
            <Text className="text-xs font-semibold" style={{ color: tokens.colors.semantic.success }}>
              {adminRole || 'loading...'}
            </Text>
          </View>
        </View>

        <View className="w-44">
          <ThemeToggle />
        </View>
      </View>

      {/* Navigation Tabs Bar */}
      <View
        className="border-b"
        style={{
          backgroundColor: activeColors.surfaceSubtle,
          borderColor: activeColors.borderSubtle,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: tokens.spacing.md,
            paddingVertical: 6,
            flexDirection: 'row',
            gap: 6,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.route || (item.route === '/admin' && pathname === '/admin/');
            const IconComponent = item.icon;

            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => router.push(item.route as any)}
                className="flex-row items-center px-3.5 py-2 rounded-xl border"
                style={{
                  backgroundColor: isActive
                    ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff')
                    : 'transparent',
                  borderColor: isActive ? activeColors.brand : 'transparent',
                }}
                activeOpacity={0.7}
              >
                <IconComponent
                  size={15}
                  color={isActive ? activeColors.brand : activeColors.text.secondary}
                />
                <Text
                  className="ml-2 text-xs font-semibold"
                  style={{
                    color: isActive ? activeColors.brand : activeColors.text.secondary,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Admin Screen Content */}
      <View className="flex-1">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: activeColors.background },
          }}
        />
      </View>
    </View>
  );
}
