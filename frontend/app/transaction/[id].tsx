import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/Header';
import { getTransactionDetails, getReconciliationMatches } from '../../api/transactions';
import { Transaction, ReconciliationMatch } from '../../api/types';
import { CheckCircle2, AlertTriangle, Info, Bot } from 'lucide-react-native';
import { Chip } from '../../components/Chip';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  const [tx, setTx] = useState<Transaction | null>(null);
  const [matches, setMatches] = useState<ReconciliationMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [txData, matchData] = await Promise.all([
          getTransactionDetails(id as string),
          getReconciliationMatches(id as string)
        ]);
        setTx(txData);
        setMatches(matchData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading || !tx) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: activeColors.background }}>
        <ActivityIndicator size="large" color={tokens.colors.light.brand} />
      </View>
    );
  }

  const isSuccess = tx.payment_status === 'completed';

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Transaction Details" />

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
        {/* Main Info Card */}
        <View 
          className="rounded-2xl p-6 mb-6 items-center"
          style={{ 
            backgroundColor: activeColors.surface,
            ...tokens.elevation[isDark ? 'dark' : 'light'].card
          }}
        >
          <View 
            className="w-16 h-16 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: isSuccess ? `${tokens.colors.semantic.success}20` : `${tokens.colors.semantic.error}20` }}
          >
            {isSuccess ? (
              <CheckCircle2 size={32} color={tokens.colors.semantic.success} />
            ) : (
              <AlertTriangle size={32} color={tokens.colors.semantic.error} />
            )}
          </View>
          
          <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size['2xl'], fontWeight: 'bold' }}>
            {tx.currency} {tx.amount.toLocaleString()}
          </Text>
          <Text className="mt-1" style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.base }}>
            {new Date(tx.transaction_time).toLocaleString()}
          </Text>

          <View className="flex-row mt-4 gap-2">
            <Chip 
              label={tx.payment_status.toUpperCase()} 
              style={{ backgroundColor: isSuccess ? tokens.colors.semantic.success : tokens.colors.semantic.warning }}
            />
            <Chip 
              label={`Settlement: ${tx.settlement_status}`}
              style={{ backgroundColor: tx.settlement_status === 'settled' ? tokens.colors.semantic.info : tokens.colors.status.settlement.pending }}
            />
          </View>
        </View>

        {/* Details List */}
        <View className="mb-6">
          <Text className="font-semibold mb-3 ml-1" style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
            TRANSACTION INFO
          </Text>
          <View className="rounded-xl overflow-hidden" style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}>
            <DetailRow label="Transaction ID" value={tx.id} activeColors={activeColors} tokens={tokens} />
            <DetailRow label="Net Amount" value={`${tx.currency} ${tx.net_amount.toLocaleString()}`} activeColors={activeColors} tokens={tokens} />
            <DetailRow label="Provider Fee" value={`${tx.currency} ${tx.provider_fee.toLocaleString()}`} activeColors={activeColors} tokens={tokens} />
          </View>
        </View>

        {/* AI Reconciliation Matches */}
        {matches.length > 0 && (
          <View className="mb-6">
            <Text className="font-semibold mb-3 ml-1 flex-row items-center" style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              <Bot size={14} color={activeColors.text.secondary} /> AI RECONCILIATION
            </Text>
            {matches.map(match => (
              <View 
                key={match.id}
                className="rounded-xl p-4 mb-3 border"
                style={{ 
                  backgroundColor: activeColors.surface, 
                  borderColor: tokens.colors.light.brand,
                  ...tokens.elevation[isDark ? 'dark' : 'light'].card 
                }}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center">
                    <Info size={16} color={tokens.colors.light.brand} />
                    <Text className="font-semibold ml-2" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                      Match: {match.match_type.toUpperCase()}
                    </Text>
                  </View>
                  <Text className="font-bold" style={{ color: tokens.colors.semantic.success, fontSize: tokens.typography.size.sm }}>
                    {(match.confidence_score * 100).toFixed(0)}% Confidence
                  </Text>
                </View>
                <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                  {match.ai_explanation}
                </Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, activeColors, tokens }: { label: string, value: string, activeColors: any, tokens: any }) {
  return (
    <View className="flex-row justify-between items-center p-4 border-b border-gray-100 dark:border-slate-800">
      <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
        {label}
      </Text>
      <Text className="font-medium" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
        {value}
      </Text>
    </View>
  );
}
