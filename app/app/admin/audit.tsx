import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Chip } from '../../components/ui/Chip';
import { SearchBar } from '../../components/ui/SearchBar';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { useAdminApi } from '../../hooks/useAdminApi';
import { AuditLog } from '@unipay/shared';
import { DateRange, getDeviceTimezoneOffsetHours, getPresetRange, toUTCRange } from '../../utils/dateUtils';
import {
  ShieldCheck,
  RefreshCw,
  X,
  FileCode,
  Clock,
  User,
} from 'lucide-react-native';

export default function AdminAuditScreen() {
  const { tokens, isDark, activeColors } = useTheme();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getPresetRange('last_30d'));

  const { apiUrl, getAuthHeaders } = useAdminApi();

  const fetchAuditLogs = React.useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      if (!apiUrl) {
        throw new Error('EXPO_PUBLIC_API_URL is not configured');
      }

      let url = `${apiUrl}/api/v1/admin/audit-logs?limit=50`;
      if (actionFilter.trim()) url += `&action=${encodeURIComponent(actionFilter.trim())}`;
      if (dateRange.startDate && dateRange.endDate) {
        const utcRange = toUTCRange(dateRange.startDate, dateRange.endDate, getDeviceTimezoneOffsetHours());
        url += `&from=${encodeURIComponent(utcRange.from)}&to=${encodeURIComponent(utcRange.to)}`;
      }

      const res = await fetch(url, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.audit_logs || []);
      }
    } catch (err: any) {
      console.log('Error fetching audit logs:', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getAuthHeaders, actionFilter, dateRange.startDate?.getTime(), dateRange.endDate?.getTime()]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditLogs(logs.length === 0);
    }, 250);

    return () => clearTimeout(timer);
  }, [actionFilter, dateRange.startDate?.getTime(), dateRange.endDate?.getTime()]);

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: activeColors.background }}
      contentContainerStyle={{ padding: tokens.spacing.lg, maxWidth: 1200, alignSelf: 'center', width: '100%' }}
    >
      <View className="flex-row justify-between items-center mb-6 flex-wrap gap-4">
        <View>
          <Text className="font-bold text-2xl" style={{ color: activeColors.text.primary }}>
            Security Audit Trail
          </Text>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
            Immutable administrative action logs and before/after mutation diffs (§11, §19)
          </Text>
        </View>
        <Button
          title="Refresh Logs"
          size="sm"
          variant="secondary"
          icon="refresh-cw"
          loading={loading}
          onPress={() => fetchAuditLogs(true)}
        />
      </View>

      <View className="flex-row gap-3 mb-6">
        <View className="flex-1">
          <SearchBar
            placeholder="Filter by action (e.g. identity.approved, payment_rail.update)..."
            value={actionFilter}
            onChangeText={(text) => setActionFilter(text)}
          />
        </View>
      </View>

      <View className="mb-6">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          label="Date Range"
        />
      </View>

      <Card style={{ padding: 0 }}>
        {loading && logs.length === 0 ? (
          <View className="p-4 gap-3">
            <Skeleton width="100%" height={50} />
            <Skeleton width="100%" height={50} />
          </View>
        ) : logs.length === 0 ? (
          <View className="p-12 items-center justify-center">
            <ShieldCheck size={36} color={activeColors.text.muted} />
            <Text className="mt-2 text-sm" style={{ color: activeColors.text.muted }}>
              No audit records found
            </Text>
          </View>
        ) : (
          logs.map((log, index) => (
            <TouchableOpacity
              key={log.id}
              className="flex-row justify-between items-center p-4 border-b flex-wrap gap-4"
              style={{
                borderColor: activeColors.border,
                backgroundColor: index % 2 === 0 ? activeColors.surface : activeColors.surfaceSubtle,
              }}
              activeOpacity={0.7}
              onPress={() => {
                setSelectedLog(log);
                setDetailModalVisible(true);
              }}
            >
              <View className="flex-2 min-w-[240px] gap-1.5">
                <View className="flex-row items-center gap-2">
                  <Text className="font-mono text-sm font-bold" style={{ color: activeColors.brand }}>
                    {log.action}
                  </Text>
                  <Chip
                    label={log.actor_type}
                    size="sm"
                  />
                </View>
                <Text className="text-xs" style={{ color: activeColors.text.secondary }}>
                  Target: {log.target_type} ({log.target_id}) · Actor: {log.actor_id}
                </Text>
              </View>

              <View className="items-end">
                <Text className="font-semibold text-xs" style={{ color: activeColors.text.primary }}>
                  {new Date(log.created_at).toLocaleTimeString()}
                </Text>
                <Text className="text-[10px]" style={{ color: activeColors.text.muted }}>
                  {new Date(log.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Card>

      {/* Audit Detail Modal */}
      <Modal visible={detailModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Card style={{ width: '100%', maxWidth: 540 }}>
            <View className="flex-row justify-between items-center pb-3 mb-4 border-b" style={{ borderColor: activeColors.border }}>
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                Audit Log Inspection
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)} className="p-1">
                <X size={20} color={activeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedLog && (
              <ScrollView style={{ maxHeight: 420 }}>
                <View className="gap-2.5">
                  <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                    Action: <Text className="font-mono font-bold" style={{ color: activeColors.brand }}>{selectedLog.action}</Text>
                  </Text>
                  <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                    Actor: {selectedLog.actor_id} ({selectedLog.actor_type})
                  </Text>
                  <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                    Target: {selectedLog.target_type} ({selectedLog.target_id})
                  </Text>
                  <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                    Timestamp: {selectedLog.created_at}
                  </Text>

                  <Text className="font-bold text-xs uppercase mt-3" style={{ color: activeColors.brand }}>
                    Before State
                  </Text>
                  <View className="p-3 rounded-xl border" style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}>
                    <Text className="font-mono text-xs" style={{ color: activeColors.text.primary }}>
                      {JSON.stringify(selectedLog.before_state || {}, null, 2)}
                    </Text>
                  </View>

                  <Text className="font-bold text-xs uppercase mt-3" style={{ color: activeColors.brand }}>
                    After State
                  </Text>
                  <View className="p-3 rounded-xl border" style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}>
                    <Text className="font-mono text-xs" style={{ color: activeColors.text.primary }}>
                      {JSON.stringify(selectedLog.after_state || {}, null, 2)}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}
