import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/Header';
import { FilterMenu, FilterGroup } from '../../components/FilterMenu';
import { ActionMenu, ActionMenuItem } from '../../components/ActionMenu';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Filter, MoreVertical } from 'lucide-react-native';
import { getTransactions } from '../../api/transactions';
import { Transaction } from '../../api/types';
import { useToast } from '../../components/Toast';
import { SearchBar } from '../../components/SearchBar';
import { Chip } from '../../components/Chip';

type TxQuickFilter = 'all' | 'paid' | 'pending' | 'review';

export default function TransactionsScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuickFilter, setActiveQuickFilter] = useState<TxQuickFilter>('all');
  
  // Bottom Sheet Refs
  const filterMenuRef = useRef<BottomSheetModal>(null);
  const actionMenuRef = useRef<BottomSheetModal>(null);

  // Filters State
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  
  // Action Menu State
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const loadData = async () => {
    try {
      const data = await getTransactions();
      setTransactions(data);
    } catch (e) {
      console.error(e);
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

  // Grouping logic (by Date)
  const groupedData = useMemo(() => {
    // 1. Filter logic
    let filtered = transactions;

    if (activeQuickFilter === 'paid') {
      filtered = filtered.filter((t) => t.payment_status === 'completed');
    }

    if (activeQuickFilter === 'pending') {
      filtered = filtered.filter((t) => t.payment_status === 'pending' || t.settlement_status === 'pending' || t.settlement_status === 'processing');
    }

    if (activeQuickFilter === 'review') {
      filtered = filtered.filter((t) => t.payment_status === 'failed' || t.settlement_status === 'failed' || t.settlement_status === 'processing');
    }

    if (searchQuery) {
      // Search by amount, status, currency, or id
      filtered = filtered.filter(t => 
        t.amount.toString().includes(searchQuery) || 
        t.payment_status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.currency.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.payer_reference || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedFilters['status'] && selectedFilters['status'].length > 0) {
      filtered = filtered.filter(t => selectedFilters['status'].includes(t.payment_status));
    }

    // 2. Group by date string
    const groups: Record<string, Transaction[]> = {};
    filtered.forEach(tx => {
      const date = new Date(tx.transaction_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(tx);
    });

    return Object.keys(groups).map(date => ({
      title: date,
      data: groups[date].sort((a, b) => new Date(b.transaction_time).getTime() - new Date(a.transaction_time).getTime())
    }));
  }, [transactions, searchQuery, selectedFilters, activeQuickFilter]);

  const quickFilters: Array<{ id: TxQuickFilter; label: string }> = [
    { id: 'all', label: 'All Transactions' },
    { id: 'paid', label: 'Paid' },
    { id: 'pending', label: 'Pending' },
    { id: 'review', label: 'Needs Review' },
  ];

  // Filter Config
  const filterGroups: FilterGroup[] = [
    {
      id: 'status',
      title: 'Payment Status',
      isMulti: true,
      options: [
        { id: 'completed', label: 'Completed' },
        { id: 'pending', label: 'Pending' },
        { id: 'failed', label: 'Failed' },
      ]
    }
  ];

  const handleFilterChange = (groupId: string, optionId: string) => {
    setSelectedFilters(prev => {
      const groupSelections = prev[groupId] || [];
      if (groupSelections.includes(optionId)) {
        return { ...prev, [groupId]: groupSelections.filter(id => id !== optionId) };
      } else {
        return { ...prev, [groupId]: [...groupSelections, optionId] };
      }
    });
  };

  const clearFilters = () => {
    setSelectedFilters({});
    filterMenuRef.current?.dismiss();
  };

  // Actions Config
  const txActions: ActionMenuItem[] = [
    {
      id: 'view',
      label: 'View Details',
      onPress: () => {
        actionMenuRef.current?.dismiss();
        if (selectedTx) router.push(`/transaction/${selectedTx.id}`);
      }
    },
    {
      id: 'copy',
      label: 'Copy Reference',
      onPress: () => {
        actionMenuRef.current?.dismiss();
        showToast('Reference copied to clipboard', 'success');
      }
    },
    {
      id: 'dispute',
      label: 'Report Issue',
      destructive: true,
      onPress: () => {
        actionMenuRef.current?.dismiss();
        showToast('Issue reported for review', 'info');
      }
    }
  ];

  const renderItem = ({ item }: { item: Transaction }) => {
    // Status color mapping
    const paymentStatusLabel = item.payment_status === 'completed'
      ? 'Succeeded'
      : item.payment_status === 'failed'
        ? 'Failed'
        : item.payment_status === 'refunded'
          ? 'Refunded'
          : 'Pending';

    let paymentChipColor = tokens.colors.status.payment.pending;
    if (item.payment_status === 'completed') paymentChipColor = tokens.colors.status.payment.success;
    if (item.payment_status === 'failed') paymentChipColor = tokens.colors.semantic.error;
    if (item.payment_status === 'refunded') paymentChipColor = activeColors.text.muted;

    let settlementChipColor = tokens.colors.status.settlement.pending;
    if (item.settlement_status === 'processing') settlementChipColor = tokens.colors.status.settlement.processing;
    if (item.settlement_status === 'settled') settlementChipColor = tokens.colors.status.settlement.settled;
    if (item.settlement_status === 'failed') settlementChipColor = tokens.colors.semantic.error;

    const settlementStatusLabel = item.settlement_status.charAt(0).toUpperCase() + item.settlement_status.slice(1);

    const payerName = item.payer_reference || 'Unknown Payer';
    return (
      <TouchableOpacity 
        className="py-4 border-b"
        style={{ borderBottomColor: activeColors.border }}
        onPress={() => router.push(`/transaction/${item.id}`)}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-start flex-1 pr-2">
            <View 
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: isDark ? tokens.colors.dark.surface : '#f1f5f9' }}
            >
              <Text style={{ fontSize: 16 }}>{item.currency === 'KES' ? 'KSh' : '$'}</Text>
            </View>

            <View className="flex-1">
              <Text className="font-semibold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                {payerName}
              </Text>
              <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs, marginTop: 2 }}>
                {item.id}
              </Text>

              <View className="flex-row flex-wrap mt-2" style={{ gap: tokens.spacing.sm }}>
                <Chip
                  label={`Payment: ${paymentStatusLabel}`}
                  selected
                  style={{ backgroundColor: paymentChipColor }}
                />
                <Chip
                  label={`Settlement: ${settlementStatusLabel}`}
                  selected
                  style={{ backgroundColor: settlementChipColor }}
                />
              </View>

              <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs, marginTop: tokens.spacing.sm }}>
                {new Date(item.transaction_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>

          <View className="items-end justify-start mr-1">
            <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
              {item.currency} {item.amount.toLocaleString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          className="p-2 absolute right-0 top-2"
          onPress={() => {
            setSelectedTx(item);
            actionMenuRef.current?.present();
          }}
        >
          <MoreVertical size={20} color={activeColors.text.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header 
        title="Transactions" 
        showBack={false}
        rightAction={
          <TouchableOpacity onPress={() => filterMenuRef.current?.present()} className="p-2">
            <Filter size={24} color={activeColors.text.primary} />
          </TouchableOpacity>
        }
      />

      <View className="px-4 py-2 bg-transparent">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tokens.spacing.sm }}
        >
          {quickFilters.map((filter) => {
            const isActive = activeQuickFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setActiveQuickFilter(filter.id)}
                className="mr-2 px-4 py-2 rounded-full"
                style={{
                  backgroundColor: isActive ? activeColors.brand : activeColors.surface,
                  borderWidth: 1,
                  borderColor: isActive ? activeColors.brand : activeColors.border,
                }}
              >
                <Text
                  style={{
                    color: isActive ? '#ffffff' : activeColors.text.secondary,
                    fontSize: tokens.typography.size.sm,
                    fontWeight: '600',
                  }}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <SearchBar 
          placeholder="Search by payer, amount, status, currency, or id..." 
          onChangeText={setSearchQuery} 
        />
      </View>

      <SectionList
        sections={groupedData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-4 py-2" style={{ backgroundColor: activeColors.background }}>
            <Text className="font-semibold" style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              {title}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: tokens.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.light.brand} />}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.base }}>
              No transactions found.
            </Text>
          </View>
        }
      />

      {/* Menus */}
      <FilterMenu 
        ref={filterMenuRef}
        groups={filterGroups}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        onApply={() => filterMenuRef.current?.dismiss()}
        onClear={clearFilters}
      />

      <ActionMenu 
        ref={actionMenuRef}
        title="Transaction Options"
        actions={txActions}
      />
    </View>
  );
}
