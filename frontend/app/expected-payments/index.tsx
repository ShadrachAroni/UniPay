import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/Header';
import { FAB } from '../../components/FAB';
import { getExpectedPayments } from '../../api/expectedPayments';
import { ExpectedPayment, ExpectedPaymentStatus } from '../../api/types';
import { Clock, Plus, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { Chip } from '../../components/Chip';

export default function ExpectedPaymentsScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();

  const [payments, setPayments] = useState<ExpectedPayment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'paid' | 'overdue'>('open');

  const load = async () => {
    try {
      const data = await getExpectedPayments();
      setPayments(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredData = payments.filter(p => {
    if (activeTab === 'open') return p.status === 'open' || p.status === 'partially_paid';
    return p.status === activeTab;
  });

  const Tab = ({ id, label }: { id: 'open' | 'paid' | 'overdue', label: string }) => {
    const isActive = activeTab === id;
    return (
      <TouchableOpacity 
        onPress={() => setActiveTab(id)}
        className="flex-1 py-3 items-center border-b-2"
        style={{ borderBottomColor: isActive ? tokens.colors.light.brand : 'transparent' }}
      >
        <Text style={{ 
          color: isActive ? tokens.colors.light.brand : activeColors.text.muted,
          fontWeight: isActive ? '600' : '500',
          fontSize: tokens.typography.size.sm
        }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: ExpectedPayment }) => {
    const isOverdue = new Date(item.due_at).getTime() < Date.now() && item.status !== 'paid';
    
    return (
      <View 
        className="rounded-xl p-4 mb-4"
        style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
      >
        <View className="flex-row justify-between mb-3">
          <Text className="font-semibold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
            {item.reference}
          </Text>
          <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
            KES {item.amount.toLocaleString()}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Clock size={14} color={isOverdue ? tokens.colors.semantic.error : activeColors.text.muted} />
            <Text 
              className="ml-1" 
              style={{ 
                color: isOverdue ? tokens.colors.semantic.error : activeColors.text.muted, 
                fontSize: tokens.typography.size.sm 
              }}
            >
              Due {new Date(item.due_at).toLocaleDateString()}
            </Text>
          </View>
          
          <Chip 
            label={item.status.replace('_', ' ').toUpperCase()} 
            style={{ 
              backgroundColor: item.status === 'paid' 
                ? tokens.colors.status.expectedPayment.paid 
                : item.status === 'partially_paid' 
                  ? tokens.colors.status.expectedPayment.partial 
                  : isOverdue ? tokens.colors.status.expectedPayment.overdue : tokens.colors.status.expectedPayment.open 
            }} 
          />
        </View>

        {item.amount_paid_to_date > 0 && item.status !== 'paid' && (
          <View className="mt-3 pt-3 border-t" style={{ borderTopColor: activeColors.border }}>
            <View className="flex-row justify-between mb-1">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>Paid so far</Text>
              <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.xs, fontWeight: '600' }}>
                KES {item.amount_paid_to_date.toLocaleString()}
              </Text>
            </View>
            {/* Progress Bar */}
            <View className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: activeColors.border }}>
              <View 
                className="h-full rounded-full" 
                style={{ 
                  backgroundColor: tokens.colors.light.brand,
                  width: `${Math.min(100, (item.amount_paid_to_date / item.amount) * 100)}%` 
                }} 
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Expected Payments" />

      {/* Tabs */}
      <View className="flex-row bg-transparent px-2 mb-2" style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: activeColors.border }}>
        <Tab id="open" label="Open" />
        <Tab id="paid" label="Paid" />
        <Tab id="overdue" label="Overdue" />
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: tokens.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.light.brand} />}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <AlertCircle size={48} color={activeColors.border} />
            <Text className="mt-4" style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.base }}>
              No {activeTab} payments found.
            </Text>
          </View>
        }
      />

      <FAB 
        icon={<Plus size={24} color="#ffffff" />} 
        onPress={() => router.push('/expected-payments/new')} 
      />
    </View>
  );
}
