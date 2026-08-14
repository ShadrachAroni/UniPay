import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/Header';
import { getExpectedPayment } from '../../api/expectedPayments';
import { ExpectedPayment } from '../../api/types';
import { ProgressBar } from '../../components/ProgressBar';
import { AlertTriangle, Clock, CheckCircle2, Share2 } from 'lucide-react-native';
import { useToast } from '../../components/Toast';

export default function ExpectedPaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const { showToast } = useToast();

  const [item, setItem] = useState<ExpectedPayment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getExpectedPayment(id as string);
        setItem(data);
      } catch (e) {
        console.error(e);
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
      <Header title="Expected Payment" showBack={true} />

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
        {/* Main Status & Progress Card */}
        <View 
          className={`rounded-2xl p-6 mb-6 border ${
            isOverdue ? 'border-red-500 bg-red-50/40 dark:bg-red-950/40' : 'border-gray-200 dark:border-slate-800'
          }`}
          style={{ backgroundColor: isOverdue ? undefined : activeColors.surface }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              {isOverdue ? (
                <AlertTriangle size={24} color={tokens.colors.semantic.error} className="mr-2" />
              ) : (
                <Clock size={24} color={tokens.colors.light.brand} className="mr-2" />
              )}
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
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

          {/* Progress Bar Component */}
          <ProgressBar 
            progress={progress} 
            color={isOverdue ? tokens.colors.semantic.error : tokens.colors.light.brand}
            height={10}
            showPercentage={true}
          />

          <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-gray-200 dark:border-slate-800">
            <View>
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>Paid to Date</Text>
              <Text className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                KES {item.amount_paid_to_date.toLocaleString()}
              </Text>
            </View>

            <View className="items-end">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>Remaining Balance</Text>
              <Text className={`font-bold text-sm ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                KES {remaining.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Details Breakdown */}
        <View className="rounded-2xl p-5 mb-6 border" style={{ backgroundColor: activeColors.surface, borderColor: activeColors.border }}>
          <Text className="text-xs font-bold uppercase mb-3" style={{ color: activeColors.text.secondary }}>
            Payment Info
          </Text>
          <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-slate-800">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>Expected Payer</Text>
            <Text className="font-semibold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>{item.payer_reference || 'Unassigned'}</Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-slate-800">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>Due Date</Text>
            <Text className={`font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`} style={{ fontSize: tokens.typography.size.sm }}>
              {new Date(item.due_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => showToast('Payment reminder sent to client!', 'success')}
          className="w-full py-4 rounded-xl flex-row items-center justify-center bg-blue-600"
        >
          <Share2 size={20} color="#ffffff" className="mr-2" />
          <Text className="font-bold text-white text-base ml-2">Send Payment Reminder</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
