import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';
import { getDashboardStats } from '../../api/dashboard';
import { getExpectedPayments } from '../../api/expectedPayments';
import { getPaymentPools } from '../../api/pools';
import { ExpectedPayment, PaymentPool } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../components/AuthProvider';
import { ArrowUpRight, ArrowDownLeft, Building2, Bell, Shield, QrCode, Lock, Share2, Copy, CheckCircle2, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomSheet } from '../../components/BottomSheet';
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useToast } from '../../components/Toast';
import { requestPayout } from '../../api/payouts';
import { StatusBadge } from '../../components/StatusBadge';

type DashboardStats = {
  balance: number;
  pending: number;
  recentCount: number;
  currency: string;
};

export default function DashboardScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const user = useAuth();
  const profile = user.profile;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expectedPayments, setExpectedPayments] = useState<ExpectedPayment[]>([]);
  const [pools, setPools] = useState<PaymentPool[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Refs
  const sendModalRef = useRef<BottomSheetModal>(null);
  const requestModalRef = useRef<BottomSheetModal>(null);
  const withdrawModalRef = useRef<BottomSheetModal>(null);
  const pinModalRef = useRef<BottomSheetModal>(null);
  const paybillModalRef = useRef<BottomSheetModal>(null);

  // Send Form State
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');

  // Request Form State
  const [requestPayer, setRequestPayer] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  // Withdraw Form State
  const [withdrawDestination, setWithdrawDestination] = useState('M-PESA');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Pending Transaction Authorization State
  const [pendingTx, setPendingTx] = useState<{ type: 'send' | 'withdraw'; amount: number; target: string } | null>(null);
  const [pin, setPin] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const loadStats = async () => {
    try {
      const [dashboardStats, expectedData, poolsData] = await Promise.all([
        getDashboardStats() as Promise<DashboardStats>,
        getExpectedPayments(),
        getPaymentPools(),
      ]);
      setStats(dashboardStats);
      setExpectedPayments(expectedData);
      setPools(poolsData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  // Step 1: Initiate Transfer/Withdrawal -> Prompts PIN Modal
  const initiateSend = () => {
    if (!sendRecipient || !sendAmount) {
      showToast('Recipient and amount are required', 'error');
      return;
    }
    const amountNum = parseFloat(sendAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    setPendingTx({ type: 'send', amount: amountNum, target: sendRecipient });
    sendModalRef.current?.dismiss();
    setPin('');
    setTimeout(() => pinModalRef.current?.present(), 300);
  };

  const initiateWithdrawal = () => {
    if (!withdrawAmount || !withdrawDestination) {
      showToast('Amount and destination are required', 'error');
      return;
    }
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    setPendingTx({ type: 'withdraw', amount: amountNum, target: withdrawDestination });
    withdrawModalRef.current?.dismiss();
    setPin('');
    setTimeout(() => pinModalRef.current?.present(), 300);
  };

  // Step 2: Confirm PIN Verification
  const verifyAndCompleteTx = async (enteredPin: string) => {
    if (enteredPin.length < 4) return;
    setIsVerifyingPin(true);

    setTimeout(async () => {
      setIsVerifyingPin(false);

      if (enteredPin !== '1234') {
        showToast('Incorrect PIN. Try 1234', 'error');
        setPin('');
        return;
      }

      pinModalRef.current?.dismiss();

      if (pendingTx?.type === 'send') {
        showToast(`Authorized! Sent KES ${pendingTx.amount.toLocaleString()} to ${pendingTx.target}`, 'success');
        setSendRecipient('');
        setSendAmount('');
        if (stats) setStats({ ...stats, balance: stats.balance - pendingTx.amount });
      } else if (pendingTx?.type === 'withdraw') {
        try {
          await requestPayout(pendingTx.amount, pendingTx.target);
          showToast(`Authorized! Withdrawal of KES ${pendingTx.amount.toLocaleString()} to ${pendingTx.target} initiated`, 'success');
          setWithdrawAmount('');
          if (stats) setStats({ ...stats, balance: stats.balance - pendingTx.amount });
        } catch (e: any) {
          showToast(e.message || 'Failed to submit withdrawal', 'error');
        }
      }
      setPendingTx(null);
      setPin('');
    }, 600);
  };

  const handleRequestSubmit = async () => {
    if (!requestPayer || !requestAmount) {
      showToast('Payer and amount are required', 'error');
      return;
    }
    const amountNum = parseFloat(requestAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    setIsRequesting(true);
    setTimeout(() => {
      setIsRequesting(false);
      requestModalRef.current?.dismiss();
      showToast(`Payment request of KES ${amountNum.toLocaleString()} sent to ${requestPayer}`, 'success');
      setRequestPayer('');
      setRequestAmount('');
    }, 600);
  };

  const ActionButton = ({ icon: Icon, label, onPress, primary = false }: any) => (
    <TouchableOpacity 
      className="items-center"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View 
        className="w-14 h-14 rounded-full items-center justify-center mb-2"
        style={{ 
          backgroundColor: primary ? tokens.colors.light.brand : activeColors.surface,
          ...(primary ? tokens.elevation[isDark ? 'dark' : 'light'].card : {})
        }}
      >
        <Icon size={24} color={primary ? '#ffffff' : activeColors.text.primary} />
      </View>
      <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm, fontWeight: '500' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const expectedOpen = expectedPayments.filter((item) => item.status === 'open' || item.status === 'partially_paid').length;
  const needsAttention = expectedPayments.filter((item) => item.status === 'overdue' || item.status === 'partially_paid').length;
  const expectedTotal = expectedPayments.reduce((sum, item) => sum + item.amount, 0);
  const collectedTotal = expectedPayments.reduce((sum, item) => sum + item.amount_paid_to_date, 0);
  const pendingStatement = Math.max(expectedTotal - collectedTotal, 0);

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      {/* Custom Header */}
      <View 
        className="flex-row items-center justify-between px-6 pb-4" 
        style={{ 
          backgroundColor: activeColors.background,
          paddingTop: Math.max(insets.top, tokens.spacing.sm)
        }}
      >
        <View className="flex-row items-center">
          <Avatar 
            name={profile?.account_type === 'business' ? (profile?.business_name || profile?.display_name || 'Business') : (profile?.owner_name || profile?.display_name || 'User')} 
            size={40} 
          />
          <View className="ml-3">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
              Good morning,
            </Text>
            {profile?.account_type === 'business' ? (
              <>
                <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                  {profile.business_name || profile.display_name}
                </Text>
                <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs }}>
                  {profile.owner_name}
                </Text>
              </>
            ) : (
              <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                {profile?.owner_name || profile?.display_name || 'User'}
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {user.isAdmin && (
            <TouchableOpacity 
              onPress={() => router.push('/admin')}
              className="px-3 py-1.5 rounded-full flex-row items-center bg-purple-100 dark:bg-purple-950 border border-purple-400"
            >
              <Shield size={16} color="#a855f7" />
              <Text className="ml-1 text-xs font-bold text-purple-700 dark:text-purple-300">Admin</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity className="w-10 h-10 items-center justify-center rounded-full" style={{ backgroundColor: activeColors.surface }}>
            <Bell size={20} color={activeColors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: tokens.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.light.brand} />}
      >
        {/* Business Account Merchant Widget with Routing & Paybill Shortcuts */}
        {user.profile?.account_type === 'business' && (
          <Animated.View 
            entering={FadeInUp.duration(400)}
            className="rounded-2xl p-5 mb-8 border"
            style={{ 
              backgroundColor: activeColors.surface,
              borderColor: tokens.colors.light.brand + '40',
              ...tokens.elevation[isDark ? 'dark' : 'light'].card
            }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Building2 size={20} color={tokens.colors.light.brand} />
                <Text className="ml-2 font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                  Merchant Money Direction
                </Text>
              </View>
              <View className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-950">
                <Text className="font-bold text-xs" style={{ color: tokens.colors.light.brand }}>BUSINESS</Text>
              </View>
            </View>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, lineHeight: 20, marginBottom: 16 }}>
              Configure where incoming payments are routed and view your client Paybill details.
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/money-direction')}
                className="flex-1 py-2.5 px-3 rounded-xl border flex-row items-center justify-center bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800"
              >
                <Building2 size={16} color={tokens.colors.light.brand} />
                <Text className="ml-1.5 font-semibold text-xs text-blue-700 dark:text-blue-300">
                  Routing Rules
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => paybillModalRef.current?.present()}
                className="flex-1 py-2.5 px-3 rounded-xl border flex-row items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
              >
                <QrCode size={16} color={tokens.colors.semantic.success} />
                <Text className="ml-1.5 font-semibold text-xs text-emerald-700 dark:text-emerald-300">
                  Paybill & QR
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Balance Card */}
        <Animated.View 
          entering={FadeIn.duration(300)}
          className="rounded-3xl p-6 mb-8"
          style={{ 
            backgroundColor: isDark ? tokens.colors.dark.surface : '#0f172a',
            ...tokens.elevation[isDark ? 'dark' : 'light'].card
          }}
        >
          <Text style={{ color: '#cbd5e1', fontSize: tokens.typography.size.sm, marginBottom: tokens.spacing.xs }}>
            Available Balance
          </Text>
          <View className="flex-row items-baseline mb-4">
            <Text style={{ color: '#f8fafc', fontSize: tokens.typography.size.lg, fontWeight: '600', marginRight: 4 }}>
              {stats?.currency || 'KES'}
            </Text>
            <Text style={{ color: '#ffffff', fontSize: tokens.typography.size['2xl'], fontWeight: 'bold' }}>
              {stats ? stats.balance.toLocaleString() : '---'}
            </Text>
          </View>
          
          <View className="flex-row items-center">
            <View className="px-2 py-1 rounded bg-slate-700 mr-2">
              <Text style={{ color: '#94a3b8', fontSize: tokens.typography.size.xs }}>Pending</Text>
            </View>
            <Text style={{ color: '#cbd5e1', fontSize: tokens.typography.size.sm, fontWeight: '500' }}>
              {stats?.currency || 'KES'} {stats ? stats.pending.toLocaleString() : '---'}
            </Text>
          </View>
        </Animated.View>

        {/* Outstanding Expected Payments Card */}
        <TouchableOpacity
          onPress={() => router.push('/expected-payments')}
          activeOpacity={0.8}
          className="rounded-2xl p-5 mb-8 border flex-row items-center justify-between"
          style={{
            backgroundColor: activeColors.surface,
            borderColor: tokens.colors.light.brand + '40',
            ...tokens.elevation[isDark ? 'dark' : 'light'].card
          }}
        >
          <View>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }} className="uppercase font-semibold mb-1">
              Outstanding Expected Payments
            </Text>
            <Text className="font-bold text-2xl" style={{ color: activeColors.text.primary }}>
              KES {expectedTotal.toLocaleString()}
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 items-center justify-center">
            <ArrowUpRight size={20} color={tokens.colors.light.brand} />
          </View>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View className="flex-row justify-around mb-8">
          <ActionButton 
            icon={ArrowUpRight} 
            label="Send" 
            onPress={() => sendModalRef.current?.present()} 
            primary 
          />
          <ActionButton 
            icon={ArrowDownLeft} 
            label="Request" 
            onPress={() => requestModalRef.current?.present()} 
          />
          <ActionButton 
            icon={Building2} 
            label="Withdraw" 
            onPress={() => withdrawModalRef.current?.present()} 
          />
        </View>

        {/* Ask UniPay */}
        <TouchableOpacity
          className="rounded-2xl px-4 py-4 mb-5"
          style={{
            backgroundColor: activeColors.surface,
            borderWidth: 1,
            borderColor: activeColors.border,
            ...tokens.elevation[isDark ? 'dark' : 'light'].card,
          }}
        >
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 4 }}>
            Ask UniPay anything
          </Text>
          <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.sm }}>
            Try "What needs attention today?"
          </Text>
        </TouchableOpacity>

        {/* Status Cards */}
        <View className="flex-row mb-4" style={{ gap: tokens.spacing.md }}>
          <TouchableOpacity
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: activeColors.surface, borderWidth: 1, borderColor: activeColors.border }}
            onPress={() => router.push('/expected-payments')}
          >
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 4 }}>Expected</Text>
            <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg, fontWeight: '700' }}>{expectedOpen}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: activeColors.surface, borderWidth: 1, borderColor: activeColors.border }}
            onPress={() => router.push('/pools')}
          >
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 4 }}>Pools</Text>
            <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg, fontWeight: '700' }}>{pools.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 rounded-2xl p-4"
            style={{
              backgroundColor: activeColors.surface,
              borderWidth: 1,
              borderColor: needsAttention > 0 ? tokens.colors.semantic.warning : activeColors.border,
            }}
          >
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 4 }}>Needs Attention</Text>
            <Text style={{ color: needsAttention > 0 ? tokens.colors.semantic.warning : activeColors.text.primary, fontSize: tokens.typography.size.lg, fontWeight: '700' }}>
              {needsAttention}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expected Payments */}
        <TouchableOpacity
          className="rounded-2xl p-4 mb-4"
          style={{
            backgroundColor: activeColors.surface,
            borderWidth: 1,
            borderColor: activeColors.border,
          }}
          onPress={() => router.push('/expected-payments')}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base, fontWeight: '700' }}>
              Expected Payments
            </Text>
            <ChevronRight size={18} color={activeColors.text.muted} />
          </View>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
            {stats?.currency || 'KES'} {expectedTotal.toLocaleString()}
          </Text>
        </TouchableOpacity>

        {/* Collections Summary */}
        <View
          className="rounded-2xl p-4 mb-8"
          style={{
            backgroundColor: activeColors.surface,
            borderWidth: 1,
            borderColor: activeColors.border,
          }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base, fontWeight: '700' }}>Collected</Text>
            <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base, fontWeight: '700' }}>
              {stats?.currency || 'KES'} {collectedTotal.toLocaleString()}
            </Text>
          </View>
          <View className="h-px mb-4" style={{ backgroundColor: activeColors.border }} />
          <View className="flex-row items-center justify-between">
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>Pending statement</Text>
            <Text style={{ color: tokens.colors.semantic.warning, fontSize: tokens.typography.size.base, fontWeight: '700' }}>
              {stats?.currency || 'KES'} {pendingStatement.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Recent Activity Section Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}>
            Recent Activity
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
            <Text style={{ color: tokens.colors.light.brand, fontSize: tokens.typography.size.sm, fontWeight: '600' }}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dashboard Recent Activity Preview */}
        <View className="mb-6">
          {[
            { id: 'tx_1', amount: 5000, currency: 'KES', payment_status: 'completed', settlement_status: 'settled', time: '2h ago' },
            { id: 'tx_2', amount: 1250, currency: 'KES', payment_status: 'completed', settlement_status: 'processing', time: '5h ago' }
          ].map((tx) => (
            <TouchableOpacity 
              key={tx.id}
              onPress={() => router.push(`/transaction/${tx.id}`)}
              className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-slate-800"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 items-center justify-center mr-3">
                  <Text className="font-bold text-xs text-blue-600 dark:text-blue-400">{tx.currency}</Text>
                </View>
                <View>
                  <Text className="font-semibold text-sm" style={{ color: activeColors.text.primary }}>
                    Tx #{tx.id}
                  </Text>
                  <View className="flex-row gap-1 mt-1">
                    <StatusBadge type="payment" status={tx.payment_status} />
                    <StatusBadge type="settlement" status={tx.settlement_status} />
                  </View>
                </View>
              </View>
              <Text className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                +{tx.amount.toLocaleString()} {tx.currency}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ----------------- SEND MONEY SHEET ----------------- */}
      <BottomSheet ref={sendModalRef} snapPoints={['65%']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 px-4 py-2">
          <View className="flex-row items-center mb-4">
            <ArrowUpRight size={24} color={tokens.colors.light.brand} className="mr-2" />
            <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
              Send Money
            </Text>
          </View>

          <ScrollView>
            <View className="mb-4">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 6 }}>
                Recipient (Phone or @alias)
              </Text>
              <BottomSheetTextInput
                className="px-4 h-12 rounded-xl border font-medium"
                style={{ 
                  backgroundColor: activeColors.surface, 
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                  fontSize: tokens.typography.size.base
                }}
                placeholder="+254 700 000000 or @john"
                placeholderTextColor={activeColors.text.muted}
                value={sendRecipient}
                onChangeText={setSendRecipient}
              />
            </View>

            <View className="mb-6">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 6 }}>
                Amount (KES)
              </Text>
              <BottomSheetTextInput
                className="px-4 h-12 rounded-xl border font-bold"
                style={{ 
                  backgroundColor: activeColors.surface, 
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                  fontSize: tokens.typography.size.lg
                }}
                placeholder="0.00"
                placeholderTextColor={activeColors.text.muted}
                keyboardType="numeric"
                value={sendAmount}
                onChangeText={setSendAmount}
              />
            </View>

            <TouchableOpacity
              onPress={initiateSend}
              className="w-full items-center justify-center rounded-xl py-4"
              style={{ backgroundColor: tokens.colors.light.brand }}
            >
              <Text style={{ color: '#ffffff', fontSize: tokens.typography.size.lg, fontWeight: '600' }}>
                Next: Verify PIN
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* ----------------- REQUEST MONEY SHEET ----------------- */}
      <BottomSheet ref={requestModalRef} snapPoints={['65%']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 px-4 py-2">
          <View className="flex-row items-center mb-4">
            <ArrowDownLeft size={24} color={tokens.colors.light.brand} className="mr-2" />
            <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
              Request Payment
            </Text>
          </View>

          <ScrollView>
            <View className="mb-4">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 6 }}>
                Request From (Phone or @alias)
              </Text>
              <BottomSheetTextInput
                className="px-4 h-12 rounded-xl border font-medium"
                style={{ 
                  backgroundColor: activeColors.surface, 
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                  fontSize: tokens.typography.size.base
                }}
                placeholder="+254 712 345 678"
                placeholderTextColor={activeColors.text.muted}
                value={requestPayer}
                onChangeText={setRequestPayer}
              />
            </View>

            <View className="mb-6">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 6 }}>
                Requested Amount (KES)
              </Text>
              <BottomSheetTextInput
                className="px-4 h-12 rounded-xl border font-bold"
                style={{ 
                  backgroundColor: activeColors.surface, 
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                  fontSize: tokens.typography.size.lg
                }}
                placeholder="0.00"
                placeholderTextColor={activeColors.text.muted}
                keyboardType="numeric"
                value={requestAmount}
                onChangeText={setRequestAmount}
              />
            </View>

            <TouchableOpacity
              onPress={handleRequestSubmit}
              disabled={isRequesting}
              className="w-full items-center justify-center rounded-xl py-4"
              style={{ backgroundColor: tokens.colors.light.brand, opacity: isRequesting ? 0.7 : 1 }}
            >
              <Text style={{ color: '#ffffff', fontSize: tokens.typography.size.lg, fontWeight: '600' }}>
                {isRequesting ? 'Requesting...' : 'Send Payment Request'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* ----------------- WITHDRAW FUNDS SHEET ----------------- */}
      <BottomSheet ref={withdrawModalRef} snapPoints={['65%']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 px-4 py-2">
          <View className="flex-row items-center mb-4">
            <Building2 size={24} color={tokens.colors.light.brand} className="mr-2" />
            <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
              Withdraw Funds
            </Text>
          </View>

          <ScrollView>
            <View className="mb-4">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 6 }}>
                Destination Account
              </Text>
              <View className="flex-row gap-2 mb-2">
                {['M-PESA', 'KCB Bank', 'Equity Bank'].map((dest) => (
                  <TouchableOpacity
                    key={dest}
                    onPress={() => setWithdrawDestination(dest)}
                    className={`flex-1 py-2 rounded-xl items-center border ${
                      withdrawDestination === dest ? 'bg-blue-50 dark:bg-blue-950 border-blue-500' : 'border-gray-200 dark:border-slate-800'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${withdrawDestination === dest ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-slate-400'}`}>
                      {dest}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginBottom: 6 }}>
                Withdrawal Amount (KES)
              </Text>
              <BottomSheetTextInput
                className="px-4 h-12 rounded-xl border font-bold"
                style={{ 
                  backgroundColor: activeColors.surface, 
                  borderColor: activeColors.border,
                  color: activeColors.text.primary,
                  fontSize: tokens.typography.size.lg
                }}
                placeholder="0.00"
                placeholderTextColor={activeColors.text.muted}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
            </View>

            <TouchableOpacity
              onPress={initiateWithdrawal}
              className="w-full items-center justify-center rounded-xl py-4"
              style={{ backgroundColor: tokens.colors.light.brand }}
            >
              <Text style={{ color: '#ffffff', fontSize: tokens.typography.size.lg, fontWeight: '600' }}>
                Next: Verify PIN
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* ----------------- TRANSACTION VERIFICATION PIN SHEET ----------------- */}
      <BottomSheet ref={pinModalRef} snapPoints={['60%']}>
        <View className="flex-1 px-4 py-2 items-center">
          <View className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 items-center justify-center mb-3">
            <Lock size={24} color={tokens.colors.light.brand} />
          </View>
          <Text className="font-bold text-lg mb-1" style={{ color: activeColors.text.primary }}>
            Authorize Transaction
          </Text>
          <Text className="text-center text-xs mb-6 px-6" style={{ color: activeColors.text.secondary }}>
            Enter your 4-digit security PIN to authorize {pendingTx?.type === 'send' ? `sending KES ${pendingTx.amount.toLocaleString()} to ${pendingTx.target}` : `withdrawal of KES ${pendingTx?.amount.toLocaleString()} to ${pendingTx?.target}`}
          </Text>

          {/* PIN Input Dots */}
          <View className="flex-row gap-4 mb-6">
            {[0, 1, 2, 3].map((index) => {
              const filled = pin.length > index;
              return (
                <Animated.View
                  key={index}
                  entering={ZoomIn.delay(index * 50)}
                  className={`w-12 h-12 rounded-xl border-2 items-center justify-center ${
                    filled ? 'bg-blue-500 border-blue-600' : 'bg-transparent border-gray-300 dark:border-slate-700'
                  }`}
                >
                  {filled && <View className="w-4 h-4 rounded-full bg-white" />}
                </Animated.View>
              );
            })}
          </View>

          <BottomSheetTextInput
            className="opacity-0 absolute w-full h-20"
            keyboardType="numeric"
            maxLength={4}
            value={pin}
            onChangeText={(val) => {
              setPin(val);
              if (val.length === 4) {
                verifyAndCompleteTx(val);
              }
            }}
            autoFocus
          />

          <Text className="text-xs text-gray-400 mt-2">
            Default dev PIN: <Text className="font-bold text-blue-500">1234</Text>
          </Text>

          {isVerifyingPin && (
            <Text className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400">
              Verifying Authorization...
            </Text>
          )}
        </View>
      </BottomSheet>

      {/* ----------------- MERCHANT PAYBILL & QR SHARE SHEET ----------------- */}
      <BottomSheet ref={paybillModalRef} snapPoints={['75%']}>
        <View className="flex-1 px-4 py-2 items-center">
          <View className="flex-row items-center justify-between w-full mb-4 px-2">
            <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
              Merchant Paybill & QR
            </Text>
            <View className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950">
              <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">VERIFIED MERCHANT</Text>
            </View>
          </View>

          {/* QR Code Container */}
          <Animated.View 
            entering={ZoomIn.duration(400)}
            className="w-48 h-48 rounded-3xl p-4 bg-white items-center justify-center mb-6 border border-gray-200 shadow-md"
          >
            <QrCode size={130} color="#0f172a" />
            <Text className="text-[10px] font-bold text-slate-500 mt-1 uppercase">@acme • UniPay Verified</Text>
          </Animated.View>

          {/* Paybill Details Card */}
          <View 
            className="w-full rounded-2xl p-4 mb-6 border"
            style={{ 
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border
            }}
          >
            <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-gray-200 dark:border-slate-800">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                M-PESA Paybill Number
              </Text>
              <Text className="font-bold text-base" style={{ color: activeColors.text.primary }}>
                888222
              </Text>
            </View>

            <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-gray-200 dark:border-slate-800">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                Account Name / Ref
              </Text>
              <Text className="font-bold text-base" style={{ color: activeColors.text.primary }}>
                ACME
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                UniPay Handle
              </Text>
              <Text className="font-bold text-base text-blue-600 dark:text-blue-400">
                @acme
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              showToast('Paybill details copied to clipboard!', 'success');
              paybillModalRef.current?.dismiss();
            }}
            className="w-full flex-row items-center justify-center rounded-xl py-4"
            style={{ backgroundColor: tokens.colors.light.brand }}
          >
            <Share2 size={20} color="#ffffff" className="mr-2" />
            <Text className="ml-2" style={{ color: '#ffffff', fontSize: tokens.typography.size.base, fontWeight: '600' }}>
              Share Paybill to Client
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

    </View>
  );
}
