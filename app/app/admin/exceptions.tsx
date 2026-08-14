import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Chip } from '../../components/ui/Chip';
import { ReconciliationException } from '@unipay/shared';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  ArrowRight,
  Sliders,
} from 'lucide-react-native';

export default function AdminExceptionsScreen() {
  const { tokens, isDark, activeColors } = useTheme();
  const [exceptions, setExceptions] = useState<ReconciliationException[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedException, setSelectedException] = useState<ReconciliationException | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/admin/exceptions?limit=50';
      if (categoryFilter !== 'all') url += `&category=${categoryFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: 'Bearer admin_super_demo' },
      });
      if (res.ok) {
        const data = await res.json();
        setExceptions(data.exceptions || []);
      } else {
        setExceptions([
          {
            id: 'ex-201',
            profile_id: 'p-1001',
            transaction_id: 'tx-501',
            category: 'fee_mismatch',
            status: 'open',
            details: { expected_fee: 15.0, provider_charged_fee: 25.0, rail: 'loop' },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'ex-202',
            profile_id: 'p-1002',
            transaction_id: 'tx-502',
            category: 'overpayment',
            status: 'open',
            details: { expected_amount: 1000.0, received_amount: 1500.0, reference: 'INV-8821' },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setExceptions([
        {
          id: 'ex-201',
          profile_id: 'p-1001',
          transaction_id: 'tx-501',
          category: 'fee_mismatch',
          status: 'open',
          details: { expected_fee: 15.0, provider_charged_fee: 25.0, rail: 'loop' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [categoryFilter]);

  const handleAction = async (action: 'resolve' | 'escalate') => {
    if (!selectedException) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/exceptions/${selectedException.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin_super_demo',
        },
        body: JSON.stringify({ action, notes: actionNotes }),
      });
      if (res.ok) {
        setActionModalVisible(false);
        setActionNotes('');
        fetchExceptions();
      }
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
            Transaction & Exception Oversight
          </Text>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
            System-wide reconciliation exceptions queue across all 7 categories
          </Text>
        </View>
        <Button title="Refresh Queue" size="sm" variant="secondary" icon="refresh-cw" onPress={fetchExceptions} />
      </View>

      {/* Category Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
        <View className="flex-row gap-2">
          {[
            'all',
            'amount_mismatch',
            'fee_mismatch',
            'duplicate_payment',
            'missing_order',
            'overpayment',
            'settlement_delay',
          ].map((cat) => (
            <Chip
              key={cat}
              label={cat.replace(/_/g, ' ')}
              selected={categoryFilter === cat}
              onPress={() => setCategoryFilter(cat)}
              size="sm"
            />
          ))}
        </View>
      </ScrollView>

      {/* Exceptions Table */}
      <Card style={{ padding: 0 }}>
        {loading ? (
          <View className="p-4 gap-3">
            <Skeleton width="100%" height={50} />
            <Skeleton width="100%" height={50} />
          </View>
        ) : exceptions.length === 0 ? (
          <View className="p-12 items-center justify-center">
            <CheckCircle2 size={36} color={tokens.colors.semantic.success} />
            <Text className="mt-2 text-sm" style={{ color: activeColors.text.muted }}>
              No exceptions in queue
            </Text>
          </View>
        ) : (
          exceptions.map((ex, index) => (
            <View
              key={ex.id}
              className="flex-row justify-between items-center p-4 border-b flex-wrap gap-4"
              style={{
                borderColor: activeColors.border,
                backgroundColor: index % 2 === 0 ? activeColors.surface : activeColors.surfaceSubtle,
              }}
            >
              <View className="flex-1 min-w-[260px] gap-1.5">
                <View className="flex-row items-center gap-2">
                  <Text className="font-bold text-sm" style={{ color: activeColors.text.primary }}>
                    {ex.category.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                  <Chip
                    label={ex.status}
                    variant={ex.status === 'open' ? 'warning' : 'success'}
                    size="sm"
                  />
                </View>
                <Text className="font-mono text-xs" style={{ color: activeColors.text.secondary }}>
                  Details: {JSON.stringify(ex.details)}
                </Text>
                <Text className="text-xs" style={{ color: activeColors.text.muted }}>
                  TX ID: {ex.transaction_id || 'None'} · Profile: {ex.profile_id}
                </Text>
              </View>

              <Button
                title="Intervene"
                size="sm"
                variant="outline"
                onPress={() => {
                  setSelectedException(ex);
                  setActionModalVisible(true);
                }}
              />
            </View>
          ))
        )}
      </Card>

      {/* Action Modal */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Card style={{ width: '100%', maxWidth: 500 }}>
            <View className="flex-row justify-between items-center pb-3 mb-4 border-b" style={{ borderColor: activeColors.border }}>
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                Exception Intervention
              </Text>
              <TouchableOpacity onPress={() => setActionModalVisible(false)} className="p-1">
                <X size={20} color={activeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedException && (
              <View className="gap-3">
                <Text className="font-semibold text-sm" style={{ color: activeColors.brand }}>
                  Category: {selectedException.category.replace(/_/g, ' ')}
                </Text>
                <Text className="font-mono text-xs p-3 rounded-lg border" style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border, color: activeColors.text.primary }}>
                  {JSON.stringify(selectedException.details, null, 2)}
                </Text>

                <TextInput
                  className="p-3 rounded-xl border text-sm"
                  style={{
                    backgroundColor: activeColors.input,
                    borderColor: activeColors.border,
                    color: activeColors.text.primary,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                  placeholder="Enter resolution or escalation notes..."
                  placeholderTextColor={activeColors.text.muted}
                  value={actionNotes}
                  onChangeText={setActionNotes}
                  multiline
                />

                <View className="flex-row gap-2 mt-3 flex-wrap">
                  <Button
                    title="Mark Resolved"
                    variant="success"
                    loading={actionLoading}
                    onPress={() => handleAction('resolve')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Escalate to Support"
                    variant="secondary"
                    loading={actionLoading}
                    onPress={() => handleAction('escalate')}
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
