import React, { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Header } from '../../components/ui/Header';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Card } from '../../components/ui/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { getTransactionDetails } from '../../api/transactions';
import { Transaction } from '../../api/types';

export default function TransactionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, activeColors } = useTheme();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!id) {
        setError('Missing transaction id');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getTransactionDetails(String(id));
        if (mounted) {
          setTransaction(data);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Unable to load transaction';
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Transaction Details" />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={activeColors.brand} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: tokens.colors.semantic.error, textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      ) : transaction ? (
        <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
          <Card>
            <Text
              className="font-semibold mb-2"
              style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}
            >
              Tx #{transaction.id}
            </Text>

            <View className="flex-row gap-2 mb-3">
              <StatusBadge type="payment" status={transaction.payment_status} />
              <StatusBadge type="settlement" status={transaction.settlement_status} />
            </View>

            <Text style={{ color: activeColors.text.secondary }}>
              Amount: {transaction.currency} {transaction.amount.toLocaleString()}
            </Text>
            <Text style={{ color: activeColors.text.secondary }}>
              Fee: {transaction.currency} {transaction.provider_fee.toLocaleString()}
            </Text>
            <Text style={{ color: activeColors.text.secondary }}>
              Net: {transaction.currency} {transaction.net_amount.toLocaleString()}
            </Text>
            <Text style={{ color: activeColors.text.secondary }}>
              Time: {new Date(transaction.transaction_time).toLocaleString()}
            </Text>
          </Card>
        </ScrollView>
      ) : null}
    </View>
  );
}
