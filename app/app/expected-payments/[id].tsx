import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Clock, Share2 } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/ui/Header';
import { getExpectedPayment } from '../../api/expectedPayments';
import { ExpectedPayment } from '../../api/types';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useToast } from '../../components/ui/Toast';

export default function ExpectedPaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, activeColors } = useTheme();
  const { showToast } = useToast();

  const [item, setItem] = useState<ExpectedPayment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getExpectedPayment(String(id));
        setItem(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading || !item) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: activeColors.background }}>
        <ActivityIndicator size="large" color={tokens.colors.light.brand} />
      </View>
    );
  }

  const isOverdue = item.status === 'overdue';
  const progress = item.amount > 0 ? item.amount_paid_to_date / item.amount : 0;
  const remaining = item.amount - item.amount_paid_to_date;

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Expected Payment" showBack />

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
        <View
          className={`rounded-2xl p-6 mb-6 border ${
            isOverdue
              ? 'border-red-500 bg-red-50/40 dark:bg-red-950/40'
              : 'border-gray-200 dark:border-slate-800'
          }`}
          style={{ backgroundColor: isOverdue ? undefined : activeColors.surface }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              {isOverdue ? (
                <AlertTriangle size={24} color={tokens.colors.semantic.error} />
              ) : (
                <Clock size={24} color={tokens.colors.light.brand} />
              )}
              <Text className="font-bold text-lg ml-2" style={{ color: activeColors.text.primary }}>
                {item.reference}
              </Text>
            </View>

            <View className={`px-3 py-1 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-blue-600'}`}>
              <Text className="text-xs font-bold text-white uppercase">
                {isOverdue ? 'OVERDUE' : item.status.replace('_', ' ')}
              </Text>
            </View>
          </View>

          <Text className="text-3xl font-bold mb-4" style={{ color: activeColors.text.primary }}>
            KES {item.amount.toLocaleString()}
          </Text>

          <ProgressBar
            progress={progress}
            color={isOverdue ? tokens.colors.semantic.error : tokens.colors.light.brand}
            height={10}
            showPercentage
          />

          <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-gray-200 dark:border-slate-800">
            <View>
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                Paid to Date
              </Text>
              <Text className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                KES {item.amount_paid_to_date.toLocaleString()}
              </Text>
            </View>

            <View className="items-end">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                Remaining Balance
              </Text>
              <Text
                className={`font-bold text-sm ${
                  isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                KES {remaining.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View
          className="rounded-2xl p-5 mb-6 border"
          style={{ backgroundColor: activeColors.surface, borderColor: activeColors.border }}
        >
          <Text
            className="text-xs font-bold uppercase mb-3"
            style={{ color: activeColors.text.secondary }}
          >
            Payment Info
          </Text>
          <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-slate-800">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              Expected Payer
            </Text>
            <Text
              className="font-semibold"
              style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}
            >
              {item.payer_reference || 'Unassigned'}
            </Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-slate-800">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              Due Date
            </Text>
            <Text
              className={`font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}
              style={{ fontSize: tokens.typography.size.sm }}
            >
              {new Date(item.due_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => showToast('Payment reminder sent to client!', 'success')}
          className="w-full py-4 rounded-xl flex-row items-center justify-center bg-blue-600"
        >
          <Share2 size={20} color="#ffffff" />
          <Text className="font-bold text-white text-base ml-2">Send Payment Reminder</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
