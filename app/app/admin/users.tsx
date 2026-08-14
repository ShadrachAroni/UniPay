import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal } from 'react-native';
import { colors, layout, typography } from '../../theme/tokens';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { Profile } from '@unipay/shared';

export default function AdminUsersScreen() {
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
        // Mock profiles for preview/offline
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>User & Identity Management</Text>
          <Text style={styles.pageSubtitle}>KYC verification queue, status lifecycle, and profile audits</Text>
        </View>
        <Button title="Search / Filter" size="sm" variant="secondary" icon="zap" onPress={fetchUsers} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <View style={styles.searchBox}>
          <Icon name="check" size={14} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, phone or ID..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchUsers}
          />
        </View>

        <View style={styles.pillGroup}>
          {['all', 'submitted', 'approved', 'rejected', 'unsubmitted'].map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.pill, statusFilter === st && styles.pillActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.pillText, statusFilter === st && styles.pillTextActive]}>
                {st.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Users Table */}
      <Card style={styles.tableCard}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={40} />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="shield" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No users matching filter criteria</Text>
          </View>
        ) : (
          users.map((u) => (
            <View key={u.id} style={styles.tableRow}>
              <View style={styles.userCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{u.display_name}</Text>
                  {u.verification_status === 'approved' && <VerifiedBadge size="sm" />}
                </View>
                <Text style={styles.userSub}>
                  {u.owner_name} · {u.account_type.toUpperCase()} · ID: {u.id_number || 'N/A'}
                </Text>
              </View>

              <View style={styles.statusCol}>
                <View
                  style={[
                    styles.badge,
                    u.verification_status === 'approved' && styles.badgeSuccess,
                    u.verification_status === 'submitted' && styles.badgeWarning,
                    u.verification_status === 'rejected' && styles.badgeError,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      u.verification_status === 'approved' && { color: colors.verified },
                      u.verification_status === 'submitted' && { color: colors.warning },
                      u.verification_status === 'rejected' && { color: colors.error },
                    ]}
                  >
                    {u.verification_status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.actionCol}>
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
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>KYC Verification Review</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Icon name="alert" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={styles.modalBody}>
                <Text style={styles.modalSubtitle}>Profile Details</Text>
                <Text style={styles.detailRow}>Display Name: {selectedUser.display_name}</Text>
                <Text style={styles.detailRow}>Owner Name: {selectedUser.owner_name}</Text>
                <Text style={styles.detailRow}>ID Number: {selectedUser.id_number || 'Not provided'}</Text>
                <Text style={styles.detailRow}>
                  Document URL: {selectedUser.id_document_url || 'No document submitted'}
                </Text>

                <Text style={[styles.modalSubtitle, { marginTop: 16 }]}>Reviewer Decision & Notes</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add compliance notes (e.g. verified against official registry)..."
                  placeholderTextColor={colors.textMuted}
                  value={reviewerNote}
                  onChangeText={setReviewerNote}
                  multiline
                />

                <View style={styles.modalActionButtons}>
                  <Button
                    title="Approve KYC"
                    variant="primary"
                    loading={actionLoading}
                    onPress={() => handleReviewAction('approved')}
                  />
                  <Button
                    title="Reject KYC"
                    variant="danger"
                    loading={actionLoading}
                    onPress={() => handleReviewAction('rejected')}
                  />
                  <Button
                    title="Suspend Profile"
                    variant="secondary"
                    loading={actionLoading}
                    onPress={() => handleReviewAction('suspended')}
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
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  contentContainer: {
    padding: layout.spacing.lg,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.spacing.lg,
    flexWrap: 'wrap',
    gap: layout.spacing.md,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: layout.spacing.md,
    marginBottom: layout.spacing.lg,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadius.md,
    paddingHorizontal: layout.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 10,
    fontSize: typography.sizes.sm,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.brandGlow,
    borderColor: colors.brandLight,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  pillTextActive: {
    color: colors.brandLight,
  },
  tableCard: {
    padding: 0,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexWrap: 'wrap',
    gap: layout.spacing.md,
  },
  userCol: {
    flex: 2,
    minWidth: 220,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  userSub: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  statusCol: {
    flex: 1,
    minWidth: 120,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: layout.borderRadius.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.bgInput,
  },
  badgeSuccess: {
    backgroundColor: colors.verifiedBg,
  },
  badgeWarning: {
    backgroundColor: colors.warningBg,
  },
  badgeError: {
    backgroundColor: colors.errorBg,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  actionCol: {
    flexDirection: 'row',
    gap: 8,
  },
  emptyState: {
    padding: layout.spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: colors.bgCard,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: layout.spacing.sm,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  modalBody: {
    gap: 8,
  },
  modalSubtitle: {
    color: colors.brandLight,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  detailRow: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  noteInput: {
    backgroundColor: colors.bgInput,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: layout.borderRadius.md,
    padding: layout.spacing.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
    marginTop: layout.spacing.md,
    flexWrap: 'wrap',
  },
});
