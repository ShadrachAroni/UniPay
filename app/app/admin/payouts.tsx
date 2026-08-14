import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { colors, layout, typography } from '../../theme/tokens';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { Payout, Dispute } from '@unipay/shared';

export default function AdminPayoutsScreen() {
  const [activeTab, setActiveTab] = useState<'payouts' | 'disputes'>('payouts');
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [payoutReason, setPayoutReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'payouts') {
        const res = await fetch('/api/v1/admin/payouts?limit=50', {
          headers: { Authorization: 'Bearer admin_super_demo' },
        });
        if (res.ok) {
          const data = await res.json();
          setPayouts(data.payouts || []);
        }
      } else {
        const res = await fetch('/api/v1/admin/disputes?limit=50', {
          headers: { Authorization: 'Bearer admin_super_demo' },
        });
        if (res.ok) {
          const data = await res.json();
          setDisputes(data.disputes || []);
        }
      }
    } catch {
      // Demo fallbacks
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
  }, [activeTab]);

  const handlePayoutIntervention = async (action: 'retry' | 'cancel') => {
    if (!selectedPayout) return;
    setActionLoading(true);
    try {
      await fetch(`/api/v1/admin/payouts/${selectedPayout.id}/intervene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin_super_demo',
        },
        body: JSON.stringify({ action, reason: payoutReason }),
      });
      setPayoutModalVisible(false);
      setPayoutReason('');
      fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveDispute = async (decision: 'resolved_refund' | 'resolved_rejected') => {
    if (!selectedDispute) return;
    setActionLoading(true);
    try {
      await fetch(`/api/v1/admin/disputes/${selectedDispute.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin_super_demo',
        },
        body: JSON.stringify({ decision, resolution_notes: disputeNotes }),
      });
      setDisputeModalVisible(false);
      setDisputeNotes('');
      fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Payout & Dispute Interventions</Text>
          <Text style={styles.pageSubtitle}>
            Manual intervention controls for stuck payouts and customer dispute resolution
          </Text>
        </View>
        <Button title="Refresh Queue" size="sm" variant="secondary" icon="zap" onPress={fetchData} />
      </View>

      {/* Sub-tab Selector */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.selectorBtn, activeTab === 'payouts' && styles.selectorBtnActive]}
          onPress={() => setActiveTab('payouts')}
        >
          <Text style={[styles.selectorText, activeTab === 'payouts' && styles.selectorTextActive]}>
            Payout Disbursements
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectorBtn, activeTab === 'disputes' && styles.selectorBtnActive]}
          onPress={() => setActiveTab('disputes')}
        >
          <Text style={[styles.selectorText, activeTab === 'disputes' && styles.selectorTextActive]}>
            Dispute Cases Queue
          </Text>
        </TouchableOpacity>
      </View>

      {/* Table Content */}
      <Card style={styles.tableCard}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={40} />
          </View>
        ) : activeTab === 'payouts' ? (
          payouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="check" size={32} color={colors.verified} />
              <Text style={styles.emptyText}>No payouts found</Text>
            </View>
          ) : (
            payouts.map((p) => (
              <View key={p.id} style={styles.tableRow}>
                <View style={styles.mainCol}>
                  <Text style={styles.mainTitle}>
                    KES {p.requested_amount.toLocaleString()} → {p.destination_type} ({p.destination_reference})
                  </Text>
                  <Text style={styles.subText}>
                    ID: {p.id} · Provider: {p.provider} · Profile: {p.profile_id}
                  </Text>
                </View>
                <View style={styles.statusCol}>
                  <View
                    style={[
                      styles.badge,
                      p.status === 'completed' && styles.badgeSuccess,
                      p.status === 'failed' && styles.badgeError,
                      p.status === 'processing' && styles.badgeWarning,
                    ]}
                  >
                    <Text style={styles.badgeText}>{p.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.actionCol}>
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
              </View>
            ))
          )
        ) : disputes.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="check" size={32} color={colors.verified} />
            <Text style={styles.emptyText}>No active dispute cases</Text>
          </View>
        ) : (
          disputes.map((d) => (
            <View key={d.id} style={styles.tableRow}>
              <View style={styles.mainCol}>
                <Text style={styles.mainTitle}>
                  KES {d.amount.toLocaleString()} · Reason: {d.reason}
                </Text>
                <Text style={styles.subText}>
                  Case: {d.id} · TX ID: {d.transaction_id || 'None'} · Profile: {d.profile_id}
                </Text>
              </View>
              <View style={styles.statusCol}>
                <View style={[styles.badge, d.status === 'open' ? styles.badgeWarning : styles.badgeSuccess]}>
                  <Text style={styles.badgeText}>{d.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.actionCol}>
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
            </View>
          ))
        )}
      </Card>

      {/* Payout Intervention Modal */}
      <Modal visible={payoutModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payout Intervention</Text>
            </View>
            {selectedPayout && (
              <View style={{ gap: 12 }}>
                <Text style={styles.detailText}>
                  Payout Amount: KES {selectedPayout.requested_amount.toLocaleString()}
                </Text>
                <Text style={styles.detailText}>Destination: {selectedPayout.destination_type}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Reason for intervention (audit requirement)..."
                  placeholderTextColor={colors.textMuted}
                  value={payoutReason}
                  onChangeText={setPayoutReason}
                />
                <View style={styles.modalButtons}>
                  <Button
                    title="Retry Payout"
                    variant="primary"
                    loading={actionLoading}
                    onPress={() => handlePayoutIntervention('retry')}
                  />
                  <Button
                    title="Cancel & Fail"
                    variant="danger"
                    loading={actionLoading}
                    onPress={() => handlePayoutIntervention('cancel')}
                  />
                  <Button
                    title="Close"
                    variant="secondary"
                    onPress={() => setPayoutModalVisible(false)}
                  />
                </View>
              </View>
            )}
          </Card>
        </View>
      </Modal>

      {/* Dispute Resolution Modal */}
      <Modal visible={disputeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dispute Case Resolution</Text>
            </View>
            {selectedDispute && (
              <View style={{ gap: 12 }}>
                <Text style={styles.detailText}>Dispute Amount: KES {selectedDispute.amount.toLocaleString()}</Text>
                <Text style={styles.detailText}>Reason: {selectedDispute.reason}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Resolution notes for merchant/customer..."
                  placeholderTextColor={colors.textMuted}
                  value={disputeNotes}
                  onChangeText={setDisputeNotes}
                />
                <View style={styles.modalButtons}>
                  <Button
                    title="Refund Customer"
                    variant="primary"
                    loading={actionLoading}
                    onPress={() => handleResolveDispute('resolved_refund')}
                  />
                  <Button
                    title="Reject Claim"
                    variant="danger"
                    loading={actionLoading}
                    onPress={() => handleResolveDispute('resolved_rejected')}
                  />
                  <Button
                    title="Close"
                    variant="secondary"
                    onPress={() => setDisputeModalVisible(false)}
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
  tabSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  selectorBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: layout.borderRadius.md, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  selectorBtnActive: { backgroundColor: colors.brandGlow, borderColor: colors.brandLight },
  selectorText: { color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  selectorTextActive: { color: colors.brandLight },
  tableCard: { padding: 0 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: layout.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  mainCol: { flex: 2, gap: 4 },
  mainTitle: { color: colors.textPrimary, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  subText: { color: colors.textMuted, fontSize: typography.sizes.xs },
  statusCol: { flex: 1, alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: layout.borderRadius.sm },
  badgeSuccess: { backgroundColor: colors.verifiedBg },
  badgeError: { backgroundColor: colors.errorBg },
  badgeWarning: { backgroundColor: colors.warningBg },
  badgeText: { fontSize: 10, fontWeight: typography.weights.bold, color: colors.textPrimary },
  actionCol: { marginLeft: 12 },
  emptyState: { padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: typography.sizes.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 480, backgroundColor: colors.bgCard },
  modalHeader: { marginBottom: 12 },
  modalTitle: { color: colors.textPrimary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  detailText: { color: colors.textSecondary, fontSize: typography.sizes.sm },
  input: { backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, borderRadius: layout.borderRadius.md, padding: 10, color: colors.textPrimary },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
});
