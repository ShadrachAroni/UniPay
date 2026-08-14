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
import { Profile } from '@unipay/shared';
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
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewerNote, setReviewerNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/admin/users?limit=50`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&verification_status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: 'Bearer admin_super_demo' },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        setUsers([
          {
            id: 'p-1001',
            clerk_user_id: 'user_amina',
            account_type: 'business',
            display_name: 'Amina Groceries',
            owner_name: 'Amina Mohamed',
            currency: 'KES',
            country_code: 'KE',
            status: 'active',
            verification_status: 'submitted',
            id_number: 'ID-28491029',
            id_document_url: 'https://docs.unipay.ke/id-amina.jpg',
            id_submitted_at: new Date().toISOString(),
            id_ai_check_result: { confidence: 0.96, match: true },
            created_at: new Date().toISOString(),
          },
          {
            id: 'p-1002',
            clerk_user_id: 'user_kipchoge',
            account_type: 'individual',
            display_name: 'Kipchoge Supplies',
            owner_name: 'Eliud Kipchoge',
            currency: 'KES',
            country_code: 'KE',
            status: 'active',
            verification_status: 'approved',
            id_number: 'ID-55443322',
            id_document_url: 'https://docs.unipay.ke/id-kip.jpg',
            id_submitted_at: new Date().toISOString(),
            id_reviewed_at: new Date().toISOString(),
            id_reviewer_note: 'Verified national ID matches name',
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setUsers([
        {
          id: 'p-1001',
          clerk_user_id: 'user_amina',
          account_type: 'business',
          display_name: 'Amina Groceries',
          owner_name: 'Amina Mohamed',
          currency: 'KES',
          country_code: 'KE',
          status: 'active',
          verification_status: 'submitted',
          id_number: 'ID-28491029',
          id_document_url: 'https://docs.unipay.ke/id-amina.jpg',
          id_submitted_at: new Date().toISOString(),
          id_ai_check_result: { confidence: 0.96, match: true },
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  const handleReviewAction = async (decision: 'approved' | 'rejected' | 'suspended') => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${selectedUser.id}/identity/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin_super_demo',
        },
        body: JSON.stringify({
          decision,
          reviewer_note: reviewerNote,
        }),
      });

      if (res.ok) {
        setReviewModalVisible(false);
        setReviewerNote('');
        fetchUsers();
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
      <View className="flex-row items-center justify-between mb-6 flex-wrap gap-4">
        <View>
          <Text className="font-bold text-2xl" style={{ color: activeColors.text.primary }}>
            User & Identity Management
          </Text>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
            KYC verification queue, status lifecycle, and profile audits
          </Text>
        </View>
        <Button title="Refresh Queue" size="sm" variant="secondary" icon="refresh-cw" onPress={fetchUsers} />
      </View>

      {/* Filter Row */}
      <View className="flex-row items-center justify-between gap-4 mb-6 flex-wrap">
        <View className="flex-1 min-w-[260px]">
          <SearchBar
            placeholder="Search by name, email, phone or ID..."
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              fetchUsers();
            }}
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

      {/* Users Table */}
      <Card style={{ padding: 0 }}>
        {loading ? (
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
