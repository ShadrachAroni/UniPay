import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, AlertCircle, Clock } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/ui/Header';
import { getExpectedPayments } from '../../api/expectedPayments';
import { ExpectedPayment } from '../../api/types';
import { ProgressBar } from '../../components/ui/ProgressBar';

export default function ExpectedPaymentsListScreen() {
  const { tokens, isDark, activeColors } = useTheme();
  const router = useRouter();

  const [payments, setPayments] = useState<ExpectedPayment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getExpectedPayments();
      setPayments(data);
    } catch (error) {
      console.error(error);
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

  const totalOutstanding = payments.reduce(
    (acc, p) => acc + (p.amount - p.amount_paid_to_date),
    0,
  );

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header
        title="Expected Payments"
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/expected-payments/new')}
            className="w-10 h-10 rounded-full items-center justify-center bg-blue-600"
          >
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: tokens.spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.light.brand}
          />
        }
      >
        <View
          className="rounded-2xl p-5 mb-6 border"
          style={{
            backgroundColor: activeColors.surface,
            borderColor: `${tokens.colors.light.brand}40`,
          }}
        >
          <Text
            style={{
              color: activeColors.text.secondary,
              fontSize: tokens.typography.size.xs,
            }}
            className="uppercase font-semibold mb-1"
          >
            Total Outstanding Expected
          </Text>
          <Text className="font-bold text-3xl" style={{ color: activeColors.text.primary }}>
            KES {totalOutstanding.toLocaleString()}
          </Text>
        </View>

        {payments.map((item) => {
          const isOverdue = item.status === 'overdue';
          const progress = item.amount > 0 ? item.amount_paid_to_date / item.amount : 0;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push(`/expected-payments/${item.id}`)}
              className={`rounded-2xl p-4 mb-4 border ${
                isOverdue
                  ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                  : 'border-gray-200 dark:border-slate-800'
              }`}
              style={{ backgroundColor: isOverdue ? undefined : activeColors.surface }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  {isOverdue ? (
                    <AlertCircle size={18} color={tokens.colors.semantic.error} />
                  ) : (
                    <Clock size={18} color={tokens.colors.light.brand} />
                  )}
                  <Text
                    className="font-bold text-base flex-1 ml-2"
                    style={{ color: activeColors.text.primary }}
                  >
                    {item.reference}
                  </Text>
                </View>

                <View
                  className={`px-2 py-0.5 rounded-full ${
                    isOverdue
                      ? 'bg-red-100 dark:bg-red-950'
                      : 'bg-blue-100 dark:bg-blue-950'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold uppercase ${
                      isOverdue
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {item.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  color: activeColors.text.secondary,
                  fontSize: tokens.typography.size.xs,
                  marginBottom: 12,
                }}
              >
                Payer: {item.payer_reference || 'Unassigned'} • Due:{' '}
                {new Date(item.due_at).toLocaleDateString()}
              </Text>

              <ProgressBar
                progress={progress}
                color={isOverdue ? tokens.colors.semantic.error : tokens.colors.light.brand}
                showPercentage
              />

              <View className="flex-row justify-between items-center mt-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                  Paid: KES {item.amount_paid_to_date.toLocaleString()}
                </Text>
                <Text
                  className="font-bold text-sm"
                  style={{ color: activeColors.text.primary }}
                >
                  Target: KES {item.amount.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
