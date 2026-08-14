import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { colors, layout, typography } from '../../theme/tokens';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { ReconciliationException } from '@unipay/shared';

export default function AdminExceptionsScreen() {
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
        // Fallback demo exceptions
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Transaction & Exception Oversight</Text>
          <Text style={styles.pageSubtitle}>
            System-wide reconciliation exceptions queue across all 7 categories
          </Text>
        </View>
        <Button title="Refresh Queue" size="sm" variant="secondary" icon="zap" onPress={fetchExceptions} />
      </View>

      {/* Category Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={styles.pillGroup}>
          {[
            'all',
            'amount_mismatch',
            'fee_mismatch',
            'duplicate_payment',
            'missing_order',
            'overpayment',
            'settlement_delay',
          ].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.pill, categoryFilter === cat && styles.pillActive]}
              onPress={() => setCategoryFilter(cat)}
            >
              <Text style={[styles.pillText, categoryFilter === cat && styles.pillTextActive]}>
                {cat.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Exceptions Table */}
      <Card style={styles.tableCard}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={40} />
          </View>
        ) : exceptions.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="check" size={32} color={colors.verified} />
            <Text style={styles.emptyText}>No exceptions in queue</Text>
          </View>
        ) : (
          exceptions.map((ex) => (
            <View key={ex.id} style={styles.tableRow}>
              <View style={styles.exceptionCol}>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryTitle}>{ex.category.replace(/_/g, ' ').toUpperCase()}</Text>
                  <View style={[styles.badge, ex.status === 'open' ? styles.badgeOpen : styles.badgeResolved]}>
                    <Text style={styles.badgeText}>{ex.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.detailsText}>
                  Details: {JSON.stringify(ex.details)}
                </Text>
                <Text style={styles.subText}>
                  TX ID: {ex.transaction_id || 'None'} · Profile: {ex.profile_id}
                </Text>
              </View>

              <View style={styles.actionCol}>
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
            </View>
          ))
        )}
      </Card>

      {/* Action Modal */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Exception Intervention</Text>
              <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                <Icon name="alert" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedException && (
              <View style={{ gap: 12 }}>
                <Text style={styles.modalSub}>
                  Category: {selectedException.category.replace(/_/g, ' ')}
                </Text>
                <Text style={styles.detailsText}>
                  {JSON.stringify(selectedException.details, null, 2)}
                </Text>

                <TextInput
                  style={styles.noteInput}
                  placeholder="Enter resolution or escalation notes..."
                  placeholderTextColor={colors.textMuted}
                  value={actionNotes}
                  onChangeText={setActionNotes}
                  multiline
                />

                <View style={styles.modalActions}>
                  <Button
                    title="Mark Resolved"
                    variant="primary"
                    loading={actionLoading}
                    onPress={() => handleAction('resolve')}
                  />
                  <Button
                    title="Escalate to Support"
                    variant="secondary"
                    loading={actionLoading}
                    onPress={() => handleAction('escalate')}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  contentContainer: { padding: layout.spacing.lg, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageTitle: { color: colors.textPrimary, fontSize: typography.sizes['2xl'], fontWeight: typography.weights.bold },
  pageSubtitle: { color: colors.textSecondary, fontSize: typography.sizes.sm, marginTop: 4 },
  pillGroup: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: layout.borderRadius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.brandGlow, borderColor: colors.brandLight },
  pillText: { color: colors.textSecondary, fontSize: 11, fontWeight: typography.weights.semibold },
  pillTextActive: { color: colors.brandLight },
  tableCard: { padding: 0 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: layout.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  exceptionCol: { flex: 1, gap: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryTitle: { color: colors.textPrimary, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  detailsText: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontFamily: typography.fontMono },
  subText: { color: colors.textMuted, fontSize: typography.sizes.xs },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: layout.borderRadius.sm },
  badgeOpen: { backgroundColor: colors.warningBg },
  badgeResolved: { backgroundColor: colors.verifiedBg },
  badgeText: { fontSize: 10, fontWeight: typography.weights.bold, color: colors.textPrimary },
  actionCol: { marginLeft: 12 },
  emptyState: { padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: typography.sizes.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 500, backgroundColor: colors.bgCard },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: colors.textPrimary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  modalSub: { color: colors.brandLight, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  noteInput: { backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, borderRadius: layout.borderRadius.md, padding: 12, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
