import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { getDashboardStats } from '../../api/dashboard';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../components/AuthProvider';
import { ArrowUpRight, ArrowDownLeft, Building2, Bell } from 'lucide-react-native';

export default function DashboardScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const { profile } = useAuth();
  
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const ActionButton = ({ icon: Icon, label, onPress, primary = false }: any) => (
    <TouchableOpacity 
      className="items-center"
      onPress={onPress}
    >
      <View 
        className="w-14 h-14 rounded-full items-center justify-center mb-2"
        style={{ 
          backgroundColor: primary ? tokens.colors.light.brand : activeColors.surface,
          ...(primary ? tokens.elevation[isDark ? 'dark' : 'light'].card : {})
        }}
      >
        <Icon size={24} color={primary ? '#ffffff' : activeColors.text.primary} />
      </View>
      <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm, fontWeight: '500' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      {/* Custom Header */}
      <View className="flex-row items-center justify-between px-6 pt-12 pb-4" style={{ backgroundColor: activeColors.background }}>
        <View className="flex-row items-center">
          <Avatar name={profile?.display_name || 'User'} size={40} />
          <View className="ml-3">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              Good morning,
            </Text>
            <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
              {profile?.display_name || 'User'}
            </Text>
          </View>
        </View>
        <TouchableOpacity className="w-10 h-10 items-center justify-center rounded-full" style={{ backgroundColor: activeColors.surface }}>
          <Bell size={20} color={activeColors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: tokens.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.light.brand} />}
      >
        {/* Balance Card */}
        <View 
          className="rounded-3xl p-6 mb-8"
          style={{ 
            backgroundColor: isDark ? tokens.colors.dark.surface : '#0f172a', // Dark stylish card for balance
            ...tokens.elevation[isDark ? 'dark' : 'light'].card
          }}
        >
          <Text style={{ color: '#cbd5e1', fontSize: tokens.typography.size.sm, marginBottom: tokens.spacing.xs }}>
            Available Balance
          </Text>
          <View className="flex-row items-baseline mb-4">
            <Text style={{ color: '#f8fafc', fontSize: tokens.typography.size.lg, fontWeight: '600', marginRight: 4 }}>
              {stats?.currency || 'KES'}
            </Text>
            <Text style={{ color: '#ffffff', fontSize: tokens.typography.size['2xl'], fontWeight: 'bold' }}>
              {stats ? stats.balance.toLocaleString() : '---'}
            </Text>
          </View>
          
          <View className="flex-row items-center">
            <View className="px-2 py-1 rounded bg-slate-700 mr-2">
              <Text style={{ color: '#94a3b8', fontSize: tokens.typography.size.xs }}>Pending</Text>
            </View>
            <Text style={{ color: '#cbd5e1', fontSize: tokens.typography.size.sm, fontWeight: '500' }}>
              {stats?.currency || 'KES'} {stats ? stats.pending.toLocaleString() : '---'}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row justify-around mb-8">
          <ActionButton icon={ArrowUpRight} label="Send" onPress={() => {}} primary />
          <ActionButton icon={ArrowDownLeft} label="Request" onPress={() => {}} />
          <ActionButton icon={Building2} label="Withdraw" onPress={() => {}} />
        </View>

        {/* Recent Activity Section Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}>
            Recent Activity
          </Text>
          <TouchableOpacity>
            <Text style={{ color: tokens.colors.light.brand, fontSize: tokens.typography.size.sm, fontWeight: '600' }}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Placeholder for list, real list is in transactions tab */}
        <View className="items-center justify-center py-10">
          <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.sm }}>
            View your transactions tab for details.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}
