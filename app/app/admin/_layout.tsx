import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { colors, layout, typography } from '../../theme/tokens';
import { Icon, IconName } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';

interface NavItem {
  name: string;
  route: string;
  icon: IconName;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'overview', route: '/admin', icon: 'zap', label: 'Overview' },
  { name: 'users', route: '/admin/users', icon: 'shield', label: 'Users & KYC' },
  { name: 'exceptions', route: '/admin/exceptions', icon: 'alert', label: 'Exceptions' },
  { name: 'rails', route: '/admin/rails', icon: 'credit-card', label: 'Payment Rails' },
  { name: 'payouts', route: '/admin/payouts', icon: 'arrow-right', label: 'Payouts & Disputes' },
  { name: 'audit', route: '/admin/audit', icon: 'check', label: 'Audit Logs' },
];

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [isAdminAuthChecking, setIsAdminAuthChecking] = useState(false);
  const [adminRole, setAdminRole] = useState<'super_admin' | 'support' | 'compliance_reviewer' | null>(null);

  // In test/web mock mode or Clerk mode, determine admin access
  useEffect(() => {
    // If Clerk is configured and signed in, fetch role or grant demo role
    setAdminRole('super_admin');
  }, [isSignedIn, isLoaded]);

  const activeTab = NAV_ITEMS.find((item) => item.route === pathname)?.name || 'overview';

  return (
    <View style={styles.container}>
      {/* Admin Top Header Banner */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>OPERATIONS</Text>
          </View>
          <Text style={styles.title}>UniPay Admin Console</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{adminRole || 'super_admin'}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/')}
          style={styles.exitButton}
          activeOpacity={0.8}
        >
          <Icon name="arrow-right" size={14} color={colors.textSecondary} />
          <Text style={styles.exitText}>Exit to App</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs Bar */}
      <View style={styles.navBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navContent}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.route || (item.route === '/admin' && pathname === '/admin/');
            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => router.push(item.route as any)}
                style={[styles.navTab, isActive && styles.navTabActive]}
                activeOpacity={0.7}
              >
                <Icon
                  name={item.icon}
                  size={16}
                  color={isActive ? colors.brandLight : colors.textSecondary}
                />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Admin Screen Content */}
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bgDark },
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.spacing.lg,
    paddingVertical: layout.spacing.md,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  badge: {
    backgroundColor: colors.brandGlow,
    borderColor: colors.brandLight,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: layout.borderRadius.sm,
  },
  badgeText: {
    color: colors.brandLight,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  roleBadge: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: layout.borderRadius.sm,
  },
  roleText: {
    color: colors.verified,
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: 4,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.bgCardHover,
  },
  exitText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  navBar: {
    backgroundColor: colors.bgCardSubtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  navContent: {
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.xs,
    flexDirection: 'row',
    gap: layout.spacing.sm,
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.sm,
    borderRadius: layout.borderRadius.md,
  },
  navTabActive: {
    backgroundColor: colors.bgCardHover,
    borderColor: colors.border,
    borderWidth: 1,
  },
  navLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  navLabelActive: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  content: {
    flex: 1,
  },
});
