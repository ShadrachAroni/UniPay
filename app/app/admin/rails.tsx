import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput, Modal } from 'react-native';
import { colors, layout, typography } from '../../theme/tokens';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';

interface RailItem {
  id: string;
  name: string;
  adapter_key: string;
  is_enabled: boolean;
  min_amount: number;
  max_amount: number;
  capabilities_json: {
    feeStructure?: { fixed: number; percentage: number };
    settlementEstimate?: string;
  };
  health?: {
    circuit_breaker_state: string;
    error_rate: number;
    total_requests: number;
  };
}

export default function AdminRailsScreen() {
  const [rails, setRails] = useState<RailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRail, setEditingRail] = useState<RailItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFeePercentage, setEditFeePercentage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRails = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/payment-rails', {
        headers: { Authorization: 'Bearer admin_super_demo' },
      });
      if (res.ok) {
        const data = await res.json();
        setRails(data.rails || []);
      }
    } catch {
      // Demo fallback
      setRails([
        {
          id: 'r-1',
          name: 'LOOP Mobile Money (NCBA)',
          adapter_key: 'loop',
          is_enabled: true,
          min_amount: 10,
          max_amount: 500000,
          capabilities_json: {
            feeStructure: { fixed: 0, percentage: 0.015 },
            settlementEstimate: 'instant',
          },
          health: { circuit_breaker_state: 'CLOSED', error_rate: 0.0, total_requests: 32 },
        },
        {
          id: 'r-2',
          name: 'Seeded Rail (Simulated Fixture)',
          adapter_key: 'seeded',
          is_enabled: true,
          min_amount: 10,
          max_amount: 500000,
          capabilities_json: {
            feeStructure: { fixed: 0, percentage: 0.005 },
            settlementEstimate: 'instant',
          },
          health: { circuit_breaker_state: 'CLOSED', error_rate: 0.0, total_requests: 16 },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRails();
  }, []);

  const handleToggleRail = async (rail: RailItem, nextEnabled: boolean) => {
    try {
      await fetch(`/api/v1/admin/payment-rails/${rail.adapter_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin_super_demo',
        },
        body: JSON.stringify({ is_enabled: nextEnabled }),
      });
      fetchRails();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveConfig = async () => {
    if (!editingRail) return;
    setActionLoading(true);
    try {
      const pct = parseFloat(editFeePercentage) / 100;
      await fetch(`/api/v1/admin/payment-rails/${editingRail.adapter_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin_super_demo',
        },
        body: JSON.stringify({ fee_percentage: pct }),
      });
      setEditModalVisible(false);
      fetchRails();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Payment Rails & Gateway Configuration</Text>
          <Text style={styles.pageSubtitle}>
            Rails as configuration (§9b) — toggle availability and adjust dynamic fee routing
          </Text>
        </View>
        <Button title="Reload Rails" size="sm" variant="secondary" icon="zap" onPress={fetchRails} />
      </View>

      <View style={styles.grid}>
        {loading ? (
          <>
            <Skeleton width="100%" height={120} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={120} />
          </>
        ) : (
          rails.map((rail) => (
            <Card key={rail.adapter_key} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.railName}>{rail.name}</Text>
                  <Text style={styles.railKey}>Adapter: {rail.adapter_key}</Text>
                </View>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, rail.is_enabled && { color: colors.verified }]}>
                    {rail.is_enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                  <Switch
                    value={rail.is_enabled}
                    onValueChange={(val) => handleToggleRail(rail, val)}
                    trackColor={{ false: colors.bgInput, true: colors.brand }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardBody}>
                <View style={styles.configCol}>
                  <Text style={styles.configLabel}>Fee Structure</Text>
                  <Text style={styles.configValue}>
                    {((rail.capabilities_json.feeStructure?.percentage || 0) * 100).toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.configCol}>
                  <Text style={styles.configLabel}>Limits (KES)</Text>
                  <Text style={styles.configValue}>
                    {rail.min_amount} – {rail.max_amount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.configCol}>
                  <Text style={styles.configLabel}>Circuit Breaker</Text>
                  <Text style={[styles.configValue, { color: colors.verified }]}>
                    {rail.health?.circuit_breaker_state || 'CLOSED'}
                  </Text>
                </View>
                <View style={styles.actionCol}>
                  <Button
                    title="Edit Fees"
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setEditingRail(rail);
                      setEditFeePercentage(
                        String((rail.capabilities_json.feeStructure?.percentage || 0) * 100)
                      );
                      setEditModalVisible(true);
                    }}
                  />
                </View>
              </View>
            </Card>
          ))
        )}
      </View>

      {/* Edit Config Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Rail Configuration</Text>
            </View>
            {editingRail && (
              <View style={{ gap: 12 }}>
                <Text style={styles.modalSub}>{editingRail.name}</Text>
                <View>
                  <Text style={styles.inputLabel}>Percentage Fee (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={editFeePercentage}
                    onChangeText={setEditFeePercentage}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.modalButtons}>
                  <Button
                    title="Save Config"
                    variant="primary"
                    loading={actionLoading}
                    onPress={handleSaveConfig}
                  />
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setEditModalVisible(false)}
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
  grid: { gap: 16 },
  card: { padding: layout.spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  railName: { color: colors.textPrimary, fontSize: typography.sizes.base, fontWeight: typography.weights.bold },
  railKey: { color: colors.textMuted, fontSize: typography.sizes.xs, fontFamily: typography.fontMono, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontSize: 10, fontWeight: typography.weights.bold, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 12 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  configCol: { minWidth: 100 },
  configLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs },
  configValue: { color: colors.textPrimary, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, marginTop: 2 },
  actionCol: { alignItems: 'flex-end' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 450, backgroundColor: colors.bgCard },
  modalHeader: { marginBottom: 12 },
  modalTitle: { color: colors.textPrimary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  modalSub: { color: colors.brandLight, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  inputLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginBottom: 4 },
  input: { backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, borderRadius: layout.borderRadius.md, padding: 10, color: colors.textPrimary },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
