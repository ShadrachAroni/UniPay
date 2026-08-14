import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/Header';
import { getPoolDetails, getPoolContributions } from '../../api/pools';
import { PaymentPool, PoolContribution } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { Chip } from '../../components/Chip';

export default function PoolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  const [pool, setPool] = useState<PaymentPool | null>(null);
  const [contributions, setContributions] = useState<PoolContribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [poolData, contribData] = await Promise.all([
          getPoolDetails(id as string),
          getPoolContributions(id as string)
        ]);
        setPool(poolData);
        setContributions(contribData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading || !pool) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: activeColors.background }}>
        <ActivityIndicator size="large" color={tokens.colors.light.brand} />
      </View>
    );
  }

  const collected = contributions.reduce((acc, curr) => acc + curr.amount_paid, 0);
  const progress = (collected / pool.target_amount) * 100;

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Pool Details" />

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
        {/* Pool Summary */}
        <View 
          className="rounded-2xl p-6 mb-8"
          style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
        >
          <View className="flex-row justify-between items-start mb-4">
            <Text className="font-bold flex-1 mr-4" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.xl }}>
              {pool.title}
            </Text>
            <Chip 
              label={pool.status.toUpperCase()} 
              style={{ backgroundColor: pool.status === 'open' ? tokens.colors.status.pool.open : tokens.colors.status.pool.closed }} 
            />
          </View>

          <View className="mb-4">
            <Text className="font-bold mb-1" style={{ color: tokens.colors.light.brand, fontSize: tokens.typography.size['2xl'] }}>
              KES {collected.toLocaleString()}
            </Text>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              collected of KES {pool.target_amount.toLocaleString()} goal
            </Text>
          </View>

          {/* Progress Bar */}
          <View className="h-3 w-full rounded-full overflow-hidden" style={{ backgroundColor: activeColors.border }}>
            <View 
              className="h-full rounded-full" 
              style={{ 
                backgroundColor: tokens.colors.light.brand,
                width: `${Math.min(100, progress)}%` 
              }} 
            />
          </View>
        </View>

        {/* Contributors */}
        <Text className="font-semibold mb-4 ml-1" style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
          CONTRIBUTORS
        </Text>

        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}>
          {contributions.map((contrib, idx) => (
            <View 
              key={contrib.id}
              className="flex-row items-center p-4"
              style={[
                idx !== contributions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: activeColors.border }
              ]}
            >
              <Avatar name={contrib.contributor_reference} size={40} />
              
              <View className="flex-1 ml-3">
                <Text className="font-semibold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                  {contrib.contributor_reference}
                </Text>
                <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginTop: 2 }}>
                  Pledged: KES {contrib.expected_amount.toLocaleString()}
                </Text>
              </View>

              <View className="items-end">
                <Text className="font-bold mb-1" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                  KES {contrib.amount_paid.toLocaleString()}
                </Text>
                <Chip 
                  label={contrib.status.replace('_', ' ').toUpperCase()} 
                  style={{ 
                    backgroundColor: contrib.status === 'paid' 
                      ? tokens.colors.semantic.success 
                      : tokens.colors.semantic.warning 
                  }} 
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
