import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/Header';
import { FAB } from '../../components/FAB';
import { getPaymentPools } from '../../api/pools';
import { PaymentPool } from '../../api/types';
import { Users, Plus, Target } from 'lucide-react-native';
import { Chip } from '../../components/Chip';

export default function PaymentPoolsScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();

  const [pools, setPools] = useState<PaymentPool[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getPaymentPools();
      setPools(data);
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

  const renderItem = ({ item }: { item: PaymentPool }) => {
    const isClosed = item.status !== 'open';
    
    // For mockup purposes, let's assume we collected some amount
    const collected = item.target_amount * 0.65; 
    const progress = (collected / item.target_amount) * 100;

    return (
      <TouchableOpacity 
        onPress={() => router.push(`/pools/${item.id}`)}
        className="rounded-xl p-5 mb-4"
        style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
      >
        <View className="flex-row justify-between mb-4">
          <View className="flex-1 mr-4">
            <Text className="font-bold mb-1" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}>
              {item.title}
            </Text>
            {item.deadline && (
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                Ends {new Date(item.deadline).toLocaleDateString()}
              </Text>
            )}
          </View>
          <Chip 
            label={item.status.toUpperCase()} 
            style={{ backgroundColor: isClosed ? tokens.colors.status.pool.closed : tokens.colors.status.pool.open }} 
          />
        </View>

        <View className="mb-2 flex-row justify-between items-end">
          <View>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 2 }}>Collected</Text>
            <Text className="font-bold" style={{ color: tokens.colors.light.brand, fontSize: tokens.typography.size.lg }}>
              KES {collected.toLocaleString()}
            </Text>
          </View>
          <View className="items-end">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 2 }}>Target</Text>
            <Text className="font-semibold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
              KES {item.target_amount.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="h-2 w-full rounded-full overflow-hidden mb-3" style={{ backgroundColor: activeColors.border }}>
          <View 
            className="h-full rounded-full" 
            style={{ 
              backgroundColor: tokens.colors.light.brand,
              width: `${Math.min(100, progress)}%` 
            }} 
          />
        </View>

        <View className="flex-row items-center pt-3 border-t" style={{ borderTopColor: activeColors.border }}>
          <Users size={16} color={activeColors.text.muted} />
          <Text className="ml-2" style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.sm }}>
            12 Contributors
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Payment Pools" />

      <FlatList
        data={pools}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: tokens.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.light.brand} />}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Target size={48} color={activeColors.border} />
            <Text className="mt-4" style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.base }}>
              No active payment pools.
            </Text>
          </View>
        }
      />

      <FAB 
        icon={<Plus size={24} color="#ffffff" />} 
        onPress={() => console.log('Create Pool')} 
      />
    </View>
  );
}
