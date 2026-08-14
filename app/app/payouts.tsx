import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Building2, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Header } from '../components/ui/Header';
import { getPayouts, requestPayout } from '../api/payouts';
import { Payout } from '../api/types';
import { useToast } from '../components/ui/Toast';
import { Chip } from '../components/ui/Chip';
import {
  BottomSheet,
  BottomSheetModal,
  BottomSheetTextInput,
} from '../components/ui/BottomSheet';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { DateRange, getPresetRange } from '../utils/dateUtils';

export default function PayoutsScreen() {
  const { tokens, isDark, activeColors } = useTheme();
  const { showToast } = useToast();

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getPresetRange('last_30d'));

  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const load = async () => {
    try {
      const data = await getPayouts();
      setPayouts(data);
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

  const handleSubmit = async () => {
    if (!amount || !destination) {
      showToast('Amount and destination are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const newPayout = await requestPayout(parseFloat(amount), destination);
      setPayouts([newPayout, ...payouts]);
      showToast('Payout requested successfully', 'success');
      bottomSheetRef.current?.dismiss();
      setAmount('');
      setDestination('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to request payout';
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPayouts = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return payouts;
    }

    const startMs = new Date(
      dateRange.startDate.getFullYear(),
      dateRange.startDate.getMonth(),
      dateRange.startDate.getDate(),
      0,
      0,
      0,
      0,
    ).getTime();
    const endMs = new Date(
      dateRange.endDate.getFullYear(),
      dateRange.endDate.getMonth(),
      dateRange.endDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();

    return payouts.filter((p) => {
      const requestedAtMs = new Date(p.requested_at).getTime();
      return requestedAtMs >= startMs && requestedAtMs <= endMs;
    });
  }, [dateRange, payouts]);

  const renderItem = ({ item }: { item: Payout }) => {
    let statusColor: string = tokens.colors.status.payout.pending;
    let Icon = Clock;

    if (item.status === 'completed') {
      statusColor = tokens.colors.status.payout.completed;
      Icon = CheckCircle2;
    } else if (item.status === 'failed') {
      statusColor = tokens.colors.status.payout.failed;
      Icon = AlertCircle;
    }

    return (
      <View
        className="rounded-xl p-4 mb-4 flex-row items-center justify-between"
        style={{
          backgroundColor: activeColors.surface,
          ...tokens.elevation[isDark ? 'dark' : 'light'].card,
        }}
      >
        <View className="flex-row items-center flex-1">
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: isDark ? tokens.colors.dark.border : '#f1f5f9' }}
          >
            <Building2 size={20} color={activeColors.text.primary} />
          </View>
          <View>
            <Text
              className="font-semibold"
              style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}
            >
              {item.destination_reference}
            </Text>
            <Text
              style={{
                color: activeColors.text.muted,
                fontSize: tokens.typography.size.xs,
                marginTop: 2,
              }}
            >
              {new Date(item.requested_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text
            className="font-bold mb-1"
            style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}
          >
            KES {item.requested_amount.toLocaleString()}
          </Text>
          <View className="flex-row items-center">
            <Icon size={12} color="#ffffff" />
            <Chip
              label={item.status}
              style={{ backgroundColor: statusColor, marginLeft: 4 }}
              textStyle={{ color: '#ffffff' }}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header
        title="Payouts"
        rightAction={
          <TouchableOpacity onPress={() => bottomSheetRef.current?.present()} className="p-2">
            <Plus size={24} color={activeColors.text.primary} />
          </TouchableOpacity>
        }
      />

      <View className="px-4 pb-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} label="Date Range" />
      </View>

      <FlatList
        data={filteredPayouts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: tokens.spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.light.brand} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.base }}>
              No payouts history.
            </Text>
          </View>
        }
      />

      <BottomSheet ref={bottomSheetRef} snapPoints={['50%']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 px-4 py-2"
        >
          <Text
            className="font-bold mb-4"
            style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}
          >
            Request Payout
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="mb-4">
              <Text
                style={{
                  color: activeColors.text.secondary,
                  fontSize: tokens.typography.size.sm,
                  marginBottom: 6,
                }}
              >
                Amount (KES)
              </Text>
              <BottomSheetTextInput
                className="px-4 h-12 rounded-xl border font-medium"
                style={{
                  backgroundColor: activeColors.surface,
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                  fontSize: tokens.typography.size.base,
                }}
                placeholder="0.00"
                placeholderTextColor={activeColors.text.muted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <View className="mb-6">
              <Text
                style={{
                  color: activeColors.text.secondary,
                  fontSize: tokens.typography.size.sm,
                  marginBottom: 6,
                }}
              >
                Destination (Bank/M-PESA)
              </Text>
              <BottomSheetTextInput
                className="px-4 h-12 rounded-xl border font-medium"
                style={{
                  backgroundColor: activeColors.surface,
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                  fontSize: tokens.typography.size.base,
                }}
                placeholder="e.g. KCB Bank ****1234"
                placeholderTextColor={activeColors.text.muted}
                value={destination}
                onChangeText={setDestination}
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="w-full items-center justify-center rounded-xl py-4"
              style={{ backgroundColor: tokens.colors.light.brand, opacity: isSubmitting ? 0.7 : 1 }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: tokens.typography.size.lg,
                  fontWeight: '600',
                }}
              >
                {isSubmitting ? 'Processing...' : 'Submit Request'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>
    </View>
  );
}
