import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Chip } from '../../components/ui/Chip';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { useToast } from '../../components/ui/Toast';
import { Payout, Dispute } from '@unipay/shared';
import { DateRange, getDeviceTimezoneOffsetHours, getPresetRange, toUTCRange } from '../../utils/dateUtils';
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react-native';

export default function AdminPayoutsScreen() {
  const { tokens, isDark, activeColors } = useTheme();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'payouts' | 'disputes'>('payouts');
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(getPresetRange('last_30d'));

  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [payoutReason, setPayoutReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState('');

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

  const fetchData = async () => {
    setLoading(true);
    try {
      const utcRange = dateRange.startDate && dateRange.endDate
        ? toUTCRange(dateRange.startDate, dateRange.endDate, getDeviceTimezoneOffsetHours())
        : null;

      if (activeTab === 'payouts') {
        let url = `${apiUrl}/api/v1/admin/payouts?limit=50`;
        if (utcRange) {
          url += `&from=${encodeURIComponent(utcRange.from)}&to=${encodeURIComponent(utcRange.to)}`;
        }
        const res = await fetch(url, {
          headers: { Authorization: 'Bearer admin_super_demo' },
        });
        if (res.ok) {
          const data = await res.json();
          setPayouts(data.payouts || []);
        }
      } else {
        let url = `${apiUrl}/api/v1/admin/disputes?limit=50`;
        if (utcRange) {
          url += `&from=${encodeURIComponent(utcRange.from)}&to=${encodeURIComponent(utcRange.to)}`;
        }
        const res = await fetch(url, {
          headers: { Authorization: 'Bearer admin_super_demo' },
        });
        if (res.ok) {
          const data = await res.json();
          setDisputes(data.disputes || []);
        }
      }
    } catch {
      if (activeTab === 'payouts') {
        setPayouts([
          {
            id: 'po-101',
            profile_id: 'p-1001',
            provider: 'loop',
            requested_amount: 15000,
            requested_currency: 'KES',
            destination_type: 'bank_account',
            destination_reference: 'NCBA-***4920',
            fee: 50,
            net_amount: 14950,
            status: 'failed',
            idempotency_key: 'idemp-po-101',
            requested_at: new Date().toISOString(),
          },
        ]);
      } else {
        setDisputes([
          {
            id: 'dsp-501',
            profile_id: 'p-1001',
            transaction_id: 'tx-201',
            reason: 'Payer claims duplicate charge during network timeout',
            amount: 2500,
            currency: 'KES',
            status: 'open',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, dateRange]);

  const handlePayoutIntervention = async (action: 'retry' | 'cancel') => {
    if (!selectedPayout) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/payouts/${selectedPayout.id}/intervene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin_super_demo',
        },
        body: JSON.stringify({ action, reason: payoutReason }),
      });
      if (res.ok) {
        setPayoutModalVisible(false);
        setPayoutReason('');
        showToast(`Payout action '${action}' completed successfully`, 'success');
        fetchData();
      } else {
        showToast('Failed to perform payout intervention', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error during payout intervention', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveDispute = async (decision: 'resolved_refund' | 'resolved_rejected') => {
    if (!selectedDispute) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/disputes/${selectedDispute.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin_super_demo',
        },
        body: JSON.stringify({ decision, resolution_notes: disputeNotes }),
      });
      if (res.ok) {
        setDisputeModalVisible(false);
        setDisputeNotes('');
        showToast(`Dispute marked as ${decision === 'resolved_refund' ? 'Refunded' : 'Rejected'}`, 'success');
        fetchData();
      } else {
        showToast('Failed to resolve dispute', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error resolving dispute', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: activeColors.background }}
      contentContainerStyle={{ padding: tokens.spacing.lg, maxWidth: 1200, alignSelf: 'center', width: '100%' }}
    >
      <View className="flex-row justify-between items-center mb-6 flex-wrap gap-4">
        <View>
          <Text className="font-bold text-2xl" style={{ color: activeColors.text.primary }}>
            Payout & Dispute Interventions
          </Text>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
            Manual intervention controls for stuck payouts and customer dispute resolution
          </Text>
        </View>
        <Button title="Refresh Queue" size="sm" variant="secondary" icon="refresh-cw" onPress={fetchData} />
      </View>

      {/* Sub-tab Selector */}
      <View className="flex-row gap-2 mb-6">
        <Chip
          label="Payout Disbursements"
          selected={activeTab === 'payouts'}
          onPress={() => setActiveTab('payouts')}
        />
        <Chip
          label="Dispute Cases Queue"
          selected={activeTab === 'disputes'}
          onPress={() => setActiveTab('disputes')}
        />
      </View>

      <View className="mb-6">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          label="Date Range"
        />
      </View>

      {/* Table Content */}
      <Card style={{ padding: 0 }}>
        {loading ? (
          <View className="p-4 gap-3">
            <Skeleton width="100%" height={50} />
            <Skeleton width="100%" height={50} />
          </View>
        ) : activeTab === 'payouts' ? (
          payouts.length === 0 ? (
            <View className="p-12 items-center justify-center">
              <CheckCircle2 size={36} color={tokens.colors.semantic.success} />
              <Text className="mt-2 text-sm" style={{ color: activeColors.text.muted }}>
                No payouts found
              </Text>
            </View>
          ) : (
            payouts.map((p, index) => (
              <View
                key={p.id}
                className="flex-row justify-between items-center p-4 border-b flex-wrap gap-4"
                style={{
                  borderColor: activeColors.border,
                  backgroundColor: index % 2 === 0 ? activeColors.surface : activeColors.surfaceSubtle,
                }}
              >
                <View className="flex-2 min-w-[240px]">
                  <Text className="font-semibold text-sm" style={{ color: activeColors.text.primary }}>
                    KES {p.requested_amount.toLocaleString()} → {p.destination_type} ({p.destination_reference})
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: activeColors.text.muted }}>
                    ID: {p.id} · Provider: {p.provider} · Profile: {p.profile_id}
                  </Text>
                </View>

                <View className="flex-1 items-center">
                  <Chip
                    label={p.status}
                    variant={
                      p.status === 'completed'
                        ? 'success'
                        : p.status === 'failed'
                        ? 'error'
                        : 'warning'
                    }
                    size="sm"
                  />
                </View>

                <Button
                  title="Intervene"
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setSelectedPayout(p);
                    setPayoutModalVisible(true);
                  }}
                />
              </View>
            ))
          )
        ) : disputes.length === 0 ? (
          <View className="p-12 items-center justify-center">
            <CheckCircle2 size={36} color={tokens.colors.semantic.success} />
            <Text className="mt-2 text-sm" style={{ color: activeColors.text.muted }}>
              No active dispute cases
            </Text>
          </View>
        ) : (
          disputes.map((d, index) => (
            <View
              key={d.id}
              className="flex-row justify-between items-center p-4 border-b flex-wrap gap-4"
              style={{
                borderColor: activeColors.border,
                backgroundColor: index % 2 === 0 ? activeColors.surface : activeColors.surfaceSubtle,
              }}
            >
              <View className="flex-2 min-w-[240px]">
                <Text className="font-semibold text-sm" style={{ color: activeColors.text.primary }}>
                  KES {d.amount.toLocaleString()} · {d.reason}
                </Text>
                <Text className="text-xs mt-1" style={{ color: activeColors.text.muted }}>
                  Case: {d.id} · TX ID: {d.transaction_id || 'None'} · Profile: {d.profile_id}
                </Text>
              </View>

              <View className="flex-1 items-center">
                <Chip
                  label={d.status}
                  variant={d.status === 'open' ? 'warning' : 'success'}
                  size="sm"
                />
              </View>

              <Button
                title="Resolve Dispute"
                size="sm"
                variant="outline"
                onPress={() => {
                  setSelectedDispute(d);
                  setDisputeModalVisible(true);
                }}
              />
            </View>
          ))
        )}
      </Card>

      {/* Payout Intervention Modal */}
      <Modal visible={payoutModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Card style={{ width: '100%', maxWidth: 480 }}>
            <View className="flex-row justify-between items-center pb-3 mb-4 border-b" style={{ borderColor: activeColors.border }}>
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                Payout Intervention
              </Text>
              <TouchableOpacity onPress={() => setPayoutModalVisible(false)} className="p-1">
                <X size={20} color={activeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedPayout && (
              <View className="gap-3">
                <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                  Payout Amount: <Text className="font-bold">KES {selectedPayout.requested_amount.toLocaleString()}</Text>
                </Text>
                <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                  Destination: <Text className="font-semibold">{selectedPayout.destination_type}</Text>
                </Text>

                <TextInput
                  className="p-3 rounded-xl border text-sm"
                  style={{
                    backgroundColor: activeColors.input,
                    borderColor: activeColors.border,
                    color: activeColors.text.primary,
                  }}
                  placeholder="Reason for intervention (audit requirement)..."
                  placeholderTextColor={activeColors.text.muted}
                  value={payoutReason}
                  onChangeText={setPayoutReason}
                />

                <View className="flex-row gap-2 mt-3 flex-wrap">
                  <Button
                    title="Retry Payout"
                    variant="primary"
                    loading={actionLoading}
                    onPress={() => handlePayoutIntervention('retry')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Cancel & Fail"
                    variant="danger"
                    loading={actionLoading}
                    onPress={() => handlePayoutIntervention('cancel')}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </Card>
        </View>
      </Modal>

      {/* Dispute Resolution Modal */}
      <Modal visible={disputeModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Card style={{ width: '100%', maxWidth: 480 }}>
            <View className="flex-row justify-between items-center pb-3 mb-4 border-b" style={{ borderColor: activeColors.border }}>
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                Dispute Case Resolution
              </Text>
              <TouchableOpacity onPress={() => setDisputeModalVisible(false)} className="p-1">
                <X size={20} color={activeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedDispute && (
              <View className="gap-3">
                <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                  Dispute Amount: <Text className="font-bold">KES {selectedDispute.amount.toLocaleString()}</Text>
                </Text>
                <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                  Reason: {selectedDispute.reason}
                </Text>

                <TextInput
                  className="p-3 rounded-xl border text-sm"
                  style={{
                    backgroundColor: activeColors.input,
                    borderColor: activeColors.border,
                    color: activeColors.text.primary,
                  }}
                  placeholder="Resolution notes for merchant/customer..."
                  placeholderTextColor={activeColors.text.muted}
                  value={disputeNotes}
                  onChangeText={setDisputeNotes}
                />

                <View className="flex-row gap-2 mt-3 flex-wrap">
                  <Button
                    title="Refund Customer"
                    variant="primary"
                    loading={actionLoading}
                    onPress={() => handleResolveDispute('resolved_refund')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Reject Claim"
                    variant="danger"
                    loading={actionLoading}
                    onPress={() => handleResolveDispute('resolved_rejected')}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}
