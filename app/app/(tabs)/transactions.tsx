import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Filter, MoreVertical } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/ui/Header';
import {
  FilterMenu,
  FilterGroup,
} from '../../components/ui/FilterMenu';
import {
  ActionMenu,
  ActionMenuItem,
} from '../../components/ui/ActionMenu';
import { BottomSheetModal } from '../../components/ui/BottomSheet';
import { getTransactions } from '../../api/transactions';
import { Transaction } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { SearchBar } from '../../components/ui/SearchBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { DateRange, getPresetRange } from '../../utils/dateUtils';

export default function TransactionsScreen() {
  const { tokens, isDark, activeColors } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(
    getPresetRange('last_30d'),
  );

  const filterMenuRef = useRef<BottomSheetModal>(null);
  const actionMenuRef = useRef<BottomSheetModal>(null);

  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(
    {},
  );
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const loadData = async () => {
    try {
      const data = await getTransactions();
      setTransactions(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const groupedData = useMemo(() => {
    let filtered = transactions;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.amount.toString().includes(searchQuery) ||
          t.payment_status.toLowerCase().includes(q),
      );
    }

    if (selectedFilters.status && selectedFilters.status.length > 0) {
      filtered = filtered.filter((t) =>
        selectedFilters.status.includes(t.payment_status),
      );
    }

    if (dateRange.startDate && dateRange.endDate) {
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

      filtered = filtered.filter((t) => {
        const txMs = new Date(t.transaction_time).getTime();
        return txMs >= startMs && txMs <= endMs;
      });
    }

    const groups: Record<string, Transaction[]> = {};
    filtered.forEach((tx) => {
      const date = new Date(tx.transaction_time).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(tx);
    });

    return Object.keys(groups).map((date) => ({
      title: date,
      data: groups[date].sort(
        (a, b) =>
          new Date(b.transaction_time).getTime() -
          new Date(a.transaction_time).getTime(),
      ),
    }));
  }, [transactions, searchQuery, selectedFilters, dateRange]);

  const filterGroups: FilterGroup[] = [
    {
      id: 'status',
      title: 'Payment Status',
      isMulti: true,
      options: [
        { id: 'completed', label: 'Completed' },
        { id: 'pending', label: 'Pending' },
        { id: 'failed', label: 'Failed' },
      ],
    },
  ];

  const handleFilterChange = (groupId: string, optionId: string) => {
    setSelectedFilters((prev) => {
      const groupSelections = prev[groupId] || [];
      if (groupSelections.includes(optionId)) {
        return {
          ...prev,
          [groupId]: groupSelections.filter((id) => id !== optionId),
        };
      }
      return {
        ...prev,
        [groupId]: [...groupSelections, optionId],
      };
    });
  };

  const clearFilters = () => {
    setSelectedFilters({});
    filterMenuRef.current?.dismiss();
  };

  const txActions: ActionMenuItem[] = [
    {
      id: 'view',
      label: 'View Details',
      onPress: () => {
        actionMenuRef.current?.dismiss();
        if (selectedTx) {
          router.push(`/transaction/${selectedTx.id}`);
        }
      },
    },
    {
      id: 'copy',
      label: 'Copy Reference',
      onPress: () => {
        actionMenuRef.current?.dismiss();
        showToast('Reference copied to clipboard', 'success');
      },
    },
    {
      id: 'dispute',
      label: 'Report Issue',
      destructive: true,
      onPress: () => {
        actionMenuRef.current?.dismiss();
        showToast('Issue reported for review', 'info');
      },
    },
  ];

  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      className="flex-row items-center justify-between py-3 border-b"
      style={{ borderBottomColor: activeColors.border }}
      onPress={() => router.push(`/transaction/${item.id}`)}
    >
      <View className="flex-row items-center flex-1">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: isDark ? tokens.colors.dark.surface : '#f1f5f9' }}
        >
          <Text style={{ fontSize: 16 }}>{item.currency === 'KES' ? 'KSh' : '$'}</Text>
        </View>
        <View>
          <Text
            className="font-semibold"
            style={{
              color: activeColors.text.primary,
              fontSize: tokens.typography.size.base,
            }}
          >
            Tx #{item.id.slice(0, 8)}
          </Text>

          <View className="flex-row gap-1 mt-1">
            <StatusBadge type="payment" status={item.payment_status} />
            <StatusBadge type="settlement" status={item.settlement_status} />
          </View>
        </View>
      </View>

      <View className="items-end justify-center mr-2">
        <Text
          className="font-bold text-emerald-600 dark:text-emerald-400"
          style={{ fontSize: tokens.typography.size.base }}
        >
          +{item.amount.toLocaleString()}
        </Text>
        <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs }}>
          {item.currency}
        </Text>
      </View>

      <TouchableOpacity
        className="p-2"
        onPress={() => {
          setSelectedTx(item);
          actionMenuRef.current?.present();
        }}
      >
        <MoreVertical size={20} color={activeColors.text.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header
        title="Transactions"
        showBack={false}
        rightAction={
          <TouchableOpacity
            onPress={() => filterMenuRef.current?.present()}
            className="p-2"
          >
            <Filter size={24} color={activeColors.text.primary} />
          </TouchableOpacity>
        }
      />

      <View className="px-4 py-2 bg-transparent">
        <SearchBar placeholder="Search transactions..." onChangeText={setSearchQuery} />
      </View>

      <View className="px-4 pb-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} label="Date Range" />
      </View>

      <SectionList
        sections={groupedData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-4 py-2" style={{ backgroundColor: activeColors.background }}>
            <Text
              className="font-semibold"
              style={{
                color: activeColors.text.secondary,
                fontSize: tokens.typography.size.sm,
              }}
            >
              {title}
            </Text>
          </View>
        )}
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.lg,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.light.brand}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text
              style={{
                color: activeColors.text.muted,
                fontSize: tokens.typography.size.base,
              }}
            >
              No transactions found.
            </Text>
          </View>
        }
      />

      <FilterMenu
        ref={filterMenuRef}
        groups={filterGroups}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        onApply={() => filterMenuRef.current?.dismiss()}
        onClear={clearFilters}
      />

      <ActionMenu ref={actionMenuRef} title="Transaction Options" actions={txActions} />
    </View>
  );
}
