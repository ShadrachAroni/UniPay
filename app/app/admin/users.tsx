import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { Chip } from '../../components/ui/Chip';
import { Avatar } from '../../components/ui/Avatar';
import { SearchBar } from '../../components/ui/SearchBar';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { useToast } from '../../components/ui/Toast';
import { useAdminApi } from '../../hooks/useAdminApi';
import { Profile } from '@unipay/shared';
import { DateRange, getDeviceTimezoneOffsetHours, getPresetRange, toUTCRange } from '../../utils/dateUtils';
import {
  Shield,
  X,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserX,
} from 'lucide-react-native';

export default function AdminUsersScreen() {
  const { tokens, isDark, activeColors } = useTheme();
  const { showToast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewerNote, setReviewerNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getPresetRange('last_30d'));

  const { apiUrl, getAuthHeaders } = useAdminApi();

  const fetchUsers = React.useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      if (!apiUrl) {
        throw new Error('EXPO_PUBLIC_API_URL is not configured');
      }

      let url = `${apiUrl}/api/v1/admin/users?limit=50`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (statusFilter !== 'all') url += `&verification_status=${statusFilter}`;
      if (dateRange.startDate && dateRange.endDate) {
        const utcRange = toUTCRange(dateRange.startDate, dateRange.endDate, getDeviceTimezoneOffsetHours());
        url += `&from=${encodeURIComponent(utcRange.from)}&to=${encodeURIComponent(utcRange.to)}`;
      }

      const res = await fetch(url, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err: any) {
      console.log('Error fetching users:', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getAuthHeaders, search, statusFilter, dateRange.startDate?.getTime(), dateRange.endDate?.getTime()]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(users.length === 0);
    }, 250);

    return () => clearTimeout(timer);
  }, [search, statusFilter, dateRange.startDate?.getTime(), dateRange.endDate?.getTime()]);

  const handleReviewAction = async (decision: 'approved' | 'rejected' | 'suspended') => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      if (!apiUrl) {
        throw new Error('EXPO_PUBLIC_API_URL is not configured');
      }

      const res = await fetch(`${apiUrl}/api/v1/admin/users/${selectedUser.id}/identity/review`, {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          decision,
          reviewer_note: reviewerNote,
        }),
      });

      if (res.ok) {
        setReviewModalVisible(false);
        setReviewerNote('');
        showToast(`User verification updated: ${decision.toUpperCase()}`, 'success');
        fetchUsers(false);
      } else {
        const errData = await res.json();
        showToast(errData.message || 'Action failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error updating user', 'error');
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
      <View className="flex-row items-center justify-between mb-6 flex-wrap gap-4">
        <View>
          <Text className="font-bold text-2xl" style={{ color: activeColors.text.primary }}>
            User & Identity Management
          </Text>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
            KYC verification queue, status lifecycle, and profile audits
          </Text>
        </View>
        <Button
          title="Refresh Queue"
          size="sm"
          variant="secondary"
          icon="refresh-cw"
          loading={loading}
          onPress={() => fetchUsers(true)}
        />
      </View>

      {/* Filter Row */}
      <View className="flex-row items-center justify-between gap-4 mb-6 flex-wrap">
        <View className="flex-1 min-w-[260px]">
          <SearchBar
            placeholder="Search by name, email, phone or ID..."
            value={search}
            onChangeText={(text: string) => setSearch(text)}
          />
        </View>

        <View className="flex-row gap-1.5 flex-wrap">
          {['all', 'submitted', 'approved', 'rejected', 'unsubmitted'].map((st) => (
            <Chip
              key={st}
              label={st}
              selected={statusFilter === st}
              onPress={() => setStatusFilter(st)}
              size="sm"
            />
          ))}
        </View>
      </View>

      <View className="mb-6">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          label="Date Range"
        />
      </View>

      {/* Users Table */}
      <Card style={{ padding: 0 }}>
        {loading && users.length === 0 ? (
          <View className="p-4 gap-3">
            <Skeleton width="100%" height={50} />
            <Skeleton width="100%" height={50} />
            <Skeleton width="100%" height={50} />
          </View>
        ) : users.length === 0 ? (
          <View className="p-12 items-center justify-center">
            <Shield size={36} color={activeColors.text.muted} />
            <Text className="mt-2 text-sm" style={{ color: activeColors.text.muted }}>
              No users matching filter criteria
            </Text>
          </View>
        ) : (
          users.map((u, index) => (
            <View
              key={u.id}
              className="flex-row items-center justify-between p-4 flex-wrap gap-4 border-b"
              style={{
                borderColor: activeColors.border,
                backgroundColor: index % 2 === 0 ? activeColors.surface : activeColors.surfaceSubtle,
              }}
            >
              <View className="flex-row items-center flex-2 min-w-[240px]">
                <Avatar name={u.display_name} id={u.id} size={40} />
                <View className="ml-3">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-semibold text-base" style={{ color: activeColors.text.primary }}>
                      {u.display_name}
                    </Text>
                    {u.verification_status === 'approved' && <VerifiedBadge size="sm" />}
                  </View>
                  <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginTop: 2 }}>
                    {u.owner_name} · {u.account_type.toUpperCase()} · ID: {u.id_number || 'N/A'}
                  </Text>
                </View>
              </View>

              <View className="flex-1 min-w-[120px]">
                <Chip
                  label={u.verification_status}
                  variant={
                    u.verification_status === 'approved'
                      ? 'success'
                      : u.verification_status === 'submitted'
                      ? 'warning'
                      : 'error'
                  }
                  size="sm"
                />
              </View>

              <View className="flex-row gap-2">
                <Button
                  title="Review KYC"
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setSelectedUser(u);
                    setReviewModalVisible(true);
                  }}
                />
              </View>
            </View>
          ))
        )}
      </Card>

      {/* KYC Review Modal */}
      <Modal visible={reviewModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Card style={{ width: '100%', maxWidth: 540 }}>
            <View className="flex-row justify-between items-center pb-3 mb-4 border-b" style={{ borderColor: activeColors.border }}>
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                KYC Verification Review
              </Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} className="p-1">
                <X size={20} color={activeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View className="gap-3">
                <Text className="font-semibold text-sm" style={{ color: activeColors.brand }}>
                  Profile Information
                </Text>
                <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                  Display Name: <Text className="font-bold">{selectedUser.display_name}</Text>
                </Text>
                <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                  Legal Owner: <Text className="font-bold">{selectedUser.owner_name}</Text>
                </Text>
                <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm }}>
                  ID Number: <Text className="font-mono">{selectedUser.id_number || 'Not provided'}</Text>
                </Text>
                <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                  Document: {selectedUser.id_document_url || 'No document submitted'}
                </Text>

                <Text className="font-semibold text-sm mt-3" style={{ color: activeColors.brand }}>
                  Compliance Decision Notes
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
                  placeholder="Add compliance notes (e.g. verified against official registry)..."
                  placeholderTextColor={activeColors.text.muted}
                  value={reviewerNote}
                  onChangeText={setReviewerNote}
                  multiline
                />

                <View className="flex-row gap-2 mt-4 flex-wrap">
                  <Button
                    title="Approve KYC"
                    variant="success"
                    loading={actionLoading}
                    onPress={() => handleReviewAction('approved')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Reject KYC"
                    variant="danger"
                    loading={actionLoading}
                    onPress={() => handleReviewAction('rejected')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Suspend Profile"
                    variant="secondary"
                    loading={actionLoading}
                    onPress={() => handleReviewAction('suspended')}
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
