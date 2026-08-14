import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Chip } from '../../components/ui/Chip';
import { useToast } from '../../components/ui/Toast';
import { useAdminApi } from '../../hooks/useAdminApi';
import { X, CreditCard, RefreshCw, Sliders, ShieldCheck } from 'lucide-react-native';

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
  const { tokens, isDark, activeColors } = useTheme();
  const { showToast } = useToast();
  const [rails, setRails] = useState<RailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRail, setEditingRail] = useState<RailItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFeePercentage, setEditFeePercentage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { apiUrl, getAuthHeaders } = useAdminApi();

  const fetchRails = React.useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      if (!apiUrl) {
        throw new Error('EXPO_PUBLIC_API_URL is not configured');
      }

      const res = await fetch(`${apiUrl}/api/v1/admin/payment-rails`, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRails(data.rails || []);
      }
    } catch (err: any) {
      console.log('Error fetching rails:', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getAuthHeaders]);

  useEffect(() => {
    fetchRails(rails.length === 0);
  }, [fetchRails]);

  const handleToggleRail = async (rail: RailItem, nextEnabled: boolean) => {
    try {
      if (!apiUrl) {
        throw new Error('EXPO_PUBLIC_API_URL is not configured');
      }

      const res = await fetch(`${apiUrl}/api/v1/admin/payment-rails/${rail.adapter_key}`, {
        method: 'PUT',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ is_enabled: nextEnabled }),
      });
      if (res.ok) {
        showToast(`Rail ${rail.name} ${nextEnabled ? 'enabled' : 'disabled'}`, 'success');
      } else {
        showToast('Failed to update rail status', 'error');
      }
      fetchRails(false);
    } catch (err: any) {
      showToast(err.message || 'Error updating rail', 'error');
    }
  };

  const handleSaveConfig = async () => {
    if (!editingRail) return;
    setActionLoading(true);
    try {
      if (!apiUrl) {
        throw new Error('EXPO_PUBLIC_API_URL is not configured');
      }

      const parsedFee = parseFloat(editFeePercentage);
      if (isNaN(parsedFee) || parsedFee < 0) {
        showToast('Please enter a valid fee percentage', 'error');
        return;
      }

      const updatedCapabilities = {
        ...editingRail.capabilities_json,
        feeStructure: {
          fixed: editingRail.capabilities_json?.feeStructure?.fixed || 0,
          percentage: parsedFee / 100,
        },
      };

      const res = await fetch(`${apiUrl}/api/v1/admin/payment-rails/${editingRail.adapter_key}`, {
        method: 'PUT',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ capabilities_json: updatedCapabilities }),
      });

      if (res.ok) {
        setEditModalVisible(false);
        showToast(`Fee structure updated for ${editingRail.name}`, 'success');
        fetchRails(false);
      } else {
        showToast('Failed to update fee configuration', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving rail config', 'error');
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
            Payment Rails & Gateway Configuration
          </Text>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
            Rails as configuration (§9b) — toggle availability and adjust dynamic fee routing
          </Text>
        </View>
        <Button
          title="Reload Rails"
          size="sm"
          variant="secondary"
          icon="refresh-cw"
          loading={loading}
          onPress={() => fetchRails(true)}
        />
      </View>

      <View className="gap-4">
        {loading && rails.length === 0 ? (
          <>
            <Skeleton width="100%" height={120} />
            <Skeleton width="100%" height={120} />
          </>
        ) : (
          rails.map((rail) => (
            <Card key={rail.adapter_key}>
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff' }}
                  >
                    <CreditCard size={20} color={activeColors.brand} />
                  </View>
                  <View>
                    <Text className="font-bold text-base" style={{ color: activeColors.text.primary }}>
                      {rail.name}
                    </Text>
                    <Text className="font-mono text-xs mt-0.5" style={{ color: activeColors.text.muted }}>
                      Adapter: {rail.adapter_key}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <Chip
                    label={rail.is_enabled ? 'ENABLED' : 'DISABLED'}
                    variant={rail.is_enabled ? 'success' : 'default'}
                    size="sm"
                  />
                  <Switch
                    value={rail.is_enabled}
                    onValueChange={(val) => handleToggleRail(rail, val)}
                    trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: activeColors.brand }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View className="h-px my-4" style={{ backgroundColor: activeColors.border }} />

              <View className="flex-row justify-between items-center flex-wrap gap-4">
                <View className="min-w-[100px]">
                  <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                    Fee Structure
                  </Text>
                  <Text className="font-semibold text-sm mt-0.5" style={{ color: activeColors.text.primary }}>
                    {((rail.capabilities_json.feeStructure?.percentage || 0) * 100).toFixed(2)}%
                  </Text>
                </View>

                <View className="min-w-[120px]">
                  <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                    Limits (KES)
                  </Text>
                  <Text className="font-semibold text-sm mt-0.5" style={{ color: activeColors.text.primary }}>
                    {rail.min_amount} – {rail.max_amount.toLocaleString()}
                  </Text>
                </View>

                <View className="min-w-[100px]">
                  <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                    Circuit Breaker
                  </Text>
                  <Text className="font-semibold text-sm mt-0.5" style={{ color: tokens.colors.semantic.success }}>
                    {rail.health?.circuit_breaker_state || 'CLOSED'}
                  </Text>
                </View>

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
            </Card>
          ))
        )}
      </View>

      {/* Edit Config Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Card style={{ width: '100%', maxWidth: 460 }}>
            <View className="flex-row justify-between items-center pb-3 mb-4 border-b" style={{ borderColor: activeColors.border }}>
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                Update Rail Configuration
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} className="p-1">
                <X size={20} color={activeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            {editingRail && (
              <View className="gap-3">
                <Text className="font-semibold text-sm" style={{ color: activeColors.brand }}>
                  {editingRail.name}
                </Text>
                <View>
                  <Text className="text-xs font-semibold mb-1" style={{ color: activeColors.text.secondary }}>
                    Percentage Fee (%)
                  </Text>
                  <TextInput
                    className="p-3 rounded-xl border font-medium text-sm"
                    style={{
                      backgroundColor: activeColors.input,
                      borderColor: activeColors.border,
                      color: activeColors.text.primary,
                    }}
                    value={editFeePercentage}
                    onChangeText={setEditFeePercentage}
                    keyboardType="numeric"
                  />
                </View>

                <View className="flex-row gap-2 mt-3">
                  <Button
                    title="Save Config"
                    variant="primary"
                    loading={actionLoading}
                    onPress={handleSaveConfig}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setEditModalVisible(false)}
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
