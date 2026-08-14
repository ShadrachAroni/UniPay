import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Profile, Alias, AccountType } from '@unipay/shared';
import { useTheme } from '../theme/ThemeProvider';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Avatar } from '../components/ui/Avatar';
import { Chip } from '../components/ui/Chip';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Divider } from '../components/ui/Divider';
import { useToast } from '../components/ui/Toast';
import {
  ShieldCheck,
  User,
  Building2,
  Lock,
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  Shield,
  CreditCard,
  LogOut,
  LogIn,
  UserPlus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';

export default function IndexScreen() {
  const { isSignedIn, signOut, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { tokens, isDark, activeColors } = useTheme();
  const { showToast } = useToast();

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

  // Profile & Verification state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states for profile onboarding
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>('individual');
  const [displayName, setDisplayName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [creatingProfile, setCreatingProfile] = useState<boolean>(false);

  // Form states for KYC submission (including face picture / selfie)
  const [idNumber, setIdNumber] = useState<string>('');
  const [idDocUrl, setIdDocUrl] = useState<string>(
    'https://storage.unipay.ke/documents/sample_national_id.jpg'
  );
  const [selfieUrl, setSelfieUrl] = useState<string>(
    'https://storage.unipay.ke/selfies/sample_face_selfie.jpg'
  );
  const [submittingKYC, setSubmittingKYC] = useState<boolean>(false);

  // Form states for Alias generation
  const [aliasHandle, setAliasHandle] = useState<string>('');
  const [generatingAlias, setGeneratingAlias] = useState<boolean>(false);

  // Public alias lookup test
  const [lookupHandle, setLookupHandle] = useState<string>('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState<boolean>(false);

  // Helper to fetch authorization header
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const token = await getToken();
      if (token) {
        return {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
      }
    } catch {
      // Fallback in test mode
    }

    const testId = user?.id || 'test_user_demo';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testId}`,
    };
  };

  // Fetch current user's profile
  const fetchUserProfile = async () => {
    setLoadingProfile(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiUrl}/api/v1/profiles/me`, { headers });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setAliases(data.aliases || []);
      } else if (res.status === 404) {
        setProfile(null);
      }
    } catch (err: any) {
      console.log('Profile fetch error:', err.message);
    } finally {
      setLoadingProfile(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    if (user?.fullName) {
      setOwnerName(user.fullName);
      setDisplayName(user.fullName);
    }
    if (user?.primaryEmailAddress?.emailAddress) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [user, isSignedIn]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserProfile();
  };

  // Create Profile Handler
  const handleCreateProfile = async () => {
    if (!displayName.trim() || !ownerName.trim()) {
      setErrorMsg('Please enter display name and legal owner name');
      showToast('Please enter display name and legal owner name', 'error');
      return;
    }

    setCreatingProfile(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const idempotencyKey = `create_profile_${Date.now()}`;

      const res = await fetch(`${apiUrl}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          ...headers,
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          account_type: selectedAccountType,
          display_name: displayName.trim(),
          owner_name: ownerName.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create profile');
      }

      setProfile(data.profile);
      showToast('Profile created successfully!', 'success');
    } catch (err: any) {
      setErrorMsg(err.message);
      showToast(err.message, 'error');
    } finally {
      setCreatingProfile(false);
    }
  };

  // Submit Identity (KYC + Face Selfie)
  const handleSubmitKYC = async () => {
    if (!profile) return;
    if (!idNumber.trim()) {
      setErrorMsg('Please enter National ID / Passport number');
      showToast('Please enter National ID / Passport number', 'error');
      return;
    }

    setSubmittingKYC(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiUrl}/api/v1/profiles/${profile.id}/identity`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id_number: idNumber.trim(),
          id_document_url: idDocUrl,
          id_selfie_url: selfieUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit identity');
      }

      setProfile(data.profile);
      showToast('Identity submitted for verification!', 'success');
      if (Platform.OS === 'web') {
        window.alert('Identity documents submitted! Status: Under Review.');
      } else {
        Alert.alert('Success', 'Identity documents submitted! Status: Under Review.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      showToast(err.message, 'error');
    } finally {
      setSubmittingKYC(false);
    }
  };

  // Generate Alias
  const handleCreateAlias = async () => {
    if (!profile) return;
    if (!aliasHandle.trim()) {
      setErrorMsg('Please enter an alias handle (e.g. amina)');
      showToast('Please enter an alias handle', 'error');
      return;
    }

    setGeneratingAlias(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const idempotencyKey = `create_alias_${Date.now()}`;

      const res = await fetch(`${apiUrl}/api/v1/profiles/${profile.id}/aliases`, {
        method: 'POST',
        headers: {
          ...headers,
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          alias: aliasHandle.trim(),
          identifier_type: 'alias',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create alias');
      }

      setAliases([...aliases, data.alias]);
      setAliasHandle('');
      showToast('Alias generated successfully!', 'success');
    } catch (err: any) {
      setErrorMsg(err.message);
      showToast(err.message, 'error');
    } finally {
      setGeneratingAlias(false);
    }
  };

  // Admin / Manual Review Toggle (for Testing)
  const handleAdminReview = async (decision: 'approved' | 'rejected') => {
    if (!profile) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiUrl}/api/v1/profiles/${profile.id}/identity/review`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            decision,
            reviewer_note: `Manual developer test review: Marked as ${decision}`,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        showToast(`KYC status updated: ${decision.toUpperCase()}`, 'info');
      }
    } catch (err: any) {
      console.log('Review error:', err.message);
    }
  };

  // Public Alias Lookup
  const handleLookup = async () => {
    if (!lookupHandle.trim()) return;
    setLookingUp(true);
    setLookupResult(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/aliases/${encodeURIComponent(lookupHandle.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setLookupResult(data);
      } else {
        setLookupResult({ error: data.message || 'Not found' });
      }
    } catch (err: any) {
      setLookupResult({ error: err.message });
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: activeColors.background }}
      contentContainerStyle={{ padding: tokens.spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeColors.brand} />}
    >
      <View className="max-w-2xl mx-auto w-full pb-16">
        {/* Custom Header Bar */}
        <View className="flex-row items-center justify-between pt-2 pb-6">
          <View className="flex-row items-center flex-1">
            <Avatar name={profile?.display_name || user?.fullName || 'UniPay User'} id={profile?.id} size={44} />
            <View className="ml-3 flex-1">
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, fontWeight: '500' }}>
                Welcome back,
              </Text>
              <Text
                className="font-bold"
                style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}
                numberOfLines={1}
              >
                {profile?.display_name || user?.fullName || 'UniPay User'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push('/admin')}
              className="p-2 rounded-xl border flex-row items-center"
              style={{
                backgroundColor: isDark ? tokens.colors.dark.surface : '#f1f5f9',
                borderColor: activeColors.border,
              }}
            >
              <Shield size={16} color={activeColors.brand} />
              <Text className="ml-1.5 font-bold text-xs" style={{ color: activeColors.brand }}>
                Admin
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme Mode Toggle Container */}
        <View className="mb-6">
          <ThemeToggle />
        </View>

        {/* Global Error Banner */}
        {errorMsg && (
          <View
            className="p-4 rounded-xl mb-6 flex-row items-center border"
            style={{
              backgroundColor: tokens.colors.semantic.errorBg,
              borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
            }}
          >
            <AlertCircle size={18} color={tokens.colors.semantic.error} />
            <Text className="ml-2.5 font-medium flex-1 text-xs" style={{ color: tokens.colors.semantic.error }}>
              {errorMsg}
            </Text>
          </View>
        )}

        {/* Balance & Overview Card (dev-d visual showcase) */}
        <View
          className="rounded-3xl p-6 mb-6"
          style={{
            backgroundColor: isDark ? tokens.colors.dark.surface : '#0f172a',
            ...tokens.elevation[isDark ? 'dark' : 'light'].floating,
          }}
        >
          <View className="flex-row justify-between items-center mb-1">
            <Text style={{ color: '#cbd5e1', fontSize: tokens.typography.size.xs, fontWeight: '500' }}>
              Universal Settlement Account
            </Text>
            <View className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30">
              <Text style={{ color: '#93c5fd', fontSize: 10, fontWeight: '700' }}>
                {profile?.account_type ? profile.account_type.toUpperCase() : 'STANDARD'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-baseline mb-4 mt-2">
            <Text style={{ color: '#94a3b8', fontSize: tokens.typography.size.lg, fontWeight: '600', marginRight: 6 }}>
              {profile?.currency || 'KES'}
            </Text>
            <Text style={{ color: '#ffffff', fontSize: tokens.typography.size['2xl'], fontWeight: 'bold' }}>
              {profile ? '0.00' : '---'}
            </Text>
          </View>

          <View className="flex-row items-center justify-between pt-3 border-t border-slate-700/80">
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
              <Text style={{ color: '#cbd5e1', fontSize: tokens.typography.size.xs }}>
                LOOP Rails: Connected
              </Text>
            </View>
            <Text style={{ color: '#94a3b8', fontSize: tokens.typography.size.xs }}>
              Single Account Model (§9b)
            </Text>
          </View>
        </View>

        {/* Clerk Authentication Card */}
        <Card className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center">
              <ShieldCheck size={18} color={activeColors.brand} />
              <Text className="font-bold ml-2 text-sm" style={{ color: activeColors.text.primary }}>
                User Authentication & Session
              </Text>
            </View>
            {isSignedIn ? (
              <TouchableOpacity
                onPress={() => signOut()}
                className="px-3 py-1 rounded-lg border flex-row items-center"
                style={{ backgroundColor: isDark ? '#1e293b' : '#fee2e2', borderColor: activeColors.border }}
              >
                <LogOut size={13} color={tokens.colors.semantic.error} />
                <Text className="ml-1 text-xs font-semibold" style={{ color: tokens.colors.semantic.error }}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="flex-row gap-2">
                <Button title="Sign In" size="sm" onPress={() => router.push('/(auth)/sign-in')} />
                <Button title="Sign Up" size="sm" variant="secondary" onPress={() => router.push('/(auth)/sign-up')} />
              </View>
            )}
          </View>

          <View
            className="p-3 rounded-xl border"
            style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.borderSubtle }}
          >
            <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs }}>
              Clerk Session:
            </Text>
            <Text className="font-mono text-xs font-semibold mt-0.5" style={{ color: activeColors.brand }}>
              {isSignedIn ? (user?.primaryEmailAddress?.emailAddress || user?.id) : 'Demo / Guest User'}
            </Text>
          </View>
        </Card>

        {/* 1. ONBOARDING: PROFILE CREATION (IF NO PROFILE) */}
        {!profile && (
          <Card className="mb-6">
            <Text className="font-bold text-lg mb-1" style={{ color: activeColors.text.primary }}>
              Step 1: Choose Account Type
            </Text>
            <Text className="text-xs mb-5" style={{ color: activeColors.text.secondary }}>
              Single Account Model (§9b): Account type is a flag, not a fork. One table for both individuals and businesses.
            </Text>

            {/* Account Type Selector */}
            <View className="flex-row gap-3 mb-5">
              <TouchableOpacity
                onPress={() => setSelectedAccountType('individual')}
                className="flex-1 p-4 rounded-2xl border"
                style={{
                  backgroundColor: selectedAccountType === 'individual' ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : activeColors.surfaceSubtle,
                  borderColor: selectedAccountType === 'individual' ? activeColors.brand : activeColors.border,
                }}
              >
                <User size={24} color={selectedAccountType === 'individual' ? activeColors.brand : activeColors.text.muted} />
                <Text className="font-bold text-sm mt-2" style={{ color: activeColors.text.primary }}>
                  Individual Account
                </Text>
                <Text className="text-xs mt-1" style={{ color: activeColors.text.secondary }}>
                  Personal P2P payments, informal merchant & instant checkout
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedAccountType('business')}
                className="flex-1 p-4 rounded-2xl border"
                style={{
                  backgroundColor: selectedAccountType === 'business' ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : activeColors.surfaceSubtle,
                  borderColor: selectedAccountType === 'business' ? activeColors.brand : activeColors.border,
                }}
              >
                <Building2 size={24} color={selectedAccountType === 'business' ? activeColors.brand : activeColors.text.muted} />
                <Text className="font-bold text-sm mt-2" style={{ color: activeColors.text.primary }}>
                  Business Account
                </Text>
                <Text className="text-xs mt-1" style={{ color: activeColors.text.secondary }}>
                  SMEs, Till / Paybill aggregation & Chama pooled funds
                </Text>
              </TouchableOpacity>
            </View>

            {/* Profile Form */}
            <View className="gap-3">
              <Input
                label="Display Name (Shown to Payers)"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={selectedAccountType === 'business' ? 'e.g. Mama Mboga Groceries' : 'e.g. Amina Mwangi'}
                icon="user"
              />

              <Input
                label="Legal Owner / Registered Name"
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="e.g. Amina Jane Mwangi"
                icon="file-text"
              />

              <Input
                label="Kenyan Phone Number"
                value={phone}
                onChangeText={setPhone}
                placeholder="+254712345678"
                keyboardType="phone-pad"
                icon="phone"
              />

              <Button
                title={creatingProfile ? 'Creating Profile...' : 'Complete Profile Setup'}
                onPress={handleCreateProfile}
                loading={creatingProfile}
                variant="primary"
                size="lg"
                style={{ marginTop: 8 }}
              />
            </View>
          </Card>
        )}

        {/* ACTIVE PROFILE OVERVIEW */}
        {profile && (
          <Card className="mb-6">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1 mr-3">
                <View className="flex-row items-center flex-wrap gap-2">
                  <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                    {profile.display_name}
                  </Text>
                  <Chip label={profile.account_type} variant="brand" size="sm" />
                </View>
                <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginTop: 4 }}>
                  Owner: {profile.owner_name} · Currency: {profile.currency}
                </Text>
              </View>

              <Chip
                label={profile.verification_status === 'submitted' ? 'Under Review' : profile.verification_status}
                variant={
                  profile.verification_status === 'approved'
                    ? 'success'
                    : profile.verification_status === 'submitted'
                    ? 'warning'
                    : 'error'
                }
                size="sm"
              />
            </View>

            {/* 2. ONBOARDING: KYC IDENTITY + FACE PICTURE SUBMISSION */}
            {profile.verification_status === 'unsubmitted' && (
              <View
                className="p-5 rounded-2xl border mt-3"
                style={{
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
                }}
              >
                <Text className="font-bold text-sm mb-1" style={{ color: tokens.colors.semantic.warning }}>
                  Step 2: Submit Identity Verification (§19)
                </Text>
                <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 16 }}>
                  Lightweight, realistic verification: Submit your ID document and selfie.
                </Text>

                <View className="gap-3">
                  <Input
                    label="National ID / Passport Number"
                    value={idNumber}
                    onChangeText={setIdNumber}
                    placeholder="e.g. 29883741"
                    icon="credit-card"
                  />

                  {/* ID Document Preview & Upload simulation */}
                  <View>
                    <Text className="font-semibold text-xs mb-1" style={{ color: activeColors.text.secondary }}>
                      ID Document Capture
                    </Text>
                    <View
                      className="p-3 rounded-xl border border-dashed flex-row items-center justify-between"
                      style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
                    >
                      <View className="flex-row items-center">
                        <FileText size={16} color={activeColors.text.muted} />
                        <Text className="ml-2 font-mono text-xs" style={{ color: activeColors.text.secondary }}>
                          national_id_card_front.jpg
                        </Text>
                      </View>
                      <Text className="text-xs font-semibold" style={{ color: tokens.colors.semantic.success }}>
                        ✓ Ready
                      </Text>
                    </View>
                  </View>

                  {/* Face Picture / Selfie Capture */}
                  <View>
                    <Text className="font-semibold text-xs mb-1" style={{ color: activeColors.text.secondary }}>
                      Face Picture / Liveness Selfie
                    </Text>
                    <View
                      className="p-3 rounded-xl border border-dashed flex-row items-center justify-between"
                      style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
                    >
                      <View className="flex-row items-center">
                        <Camera size={16} color={activeColors.text.muted} />
                        <Text className="ml-2 font-mono text-xs" style={{ color: activeColors.text.secondary }}>
                          live_face_selfie.jpg
                        </Text>
                      </View>
                      <Text className="text-xs font-semibold" style={{ color: tokens.colors.semantic.success }}>
                        ✓ Captured
                      </Text>
                    </View>
                  </View>

                  <Button
                    title={submittingKYC ? 'Submitting...' : 'Submit Verification'}
                    onPress={handleSubmitKYC}
                    loading={submittingKYC}
                    variant="primary"
                    size="md"
                    style={{ marginTop: 8 }}
                  />
                </View>
              </View>
            )}

            {/* 3. ALIAS & QR GENERATOR (GATED ON SUBMISSION) */}
            <Divider spacing={tokens.spacing.lg} />

            <View>
              <Text className="font-bold text-base mb-1" style={{ color: activeColors.text.primary }}>
                Alias & QR Code Identity Primitive (§8)
              </Text>
              <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 16 }}>
                One alias + QR per user for receiving unified payments across Kenya.
              </Text>

              {profile.verification_status === 'unsubmitted' ? (
                <View
                  className="p-5 rounded-2xl items-center border"
                  style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
                >
                  <Lock size={28} color={activeColors.text.muted} />
                  <Text className="font-bold text-xs text-center mt-2" style={{ color: activeColors.text.primary }}>
                    Alias Generation Locked
                  </Text>
                  <Text className="text-xs text-center mt-1" style={{ color: activeColors.text.muted }}>
                    Submit your ID document and face picture above to unlock your payment alias.
                  </Text>
                </View>
              ) : (
                <View>
                  {/* Generated Aliases List */}
                  {aliases.map((a) => (
                    <View
                      key={a.id}
                      className="p-4 rounded-2xl mb-3 flex-row justify-between items-center border"
                      style={{
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                        borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe',
                      }}
                    >
                      <View className="flex-1 mr-2">
                        <Text className="font-bold text-lg font-mono" style={{ color: activeColors.brand }}>
                          {a.alias}
                        </Text>
                        <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginTop: 2 }}>
                          Type: {a.identifier_type.toUpperCase()} · Status: {a.status}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => router.push(`/pay/${a.alias.replace(/^@/, '')}`)}
                        className="px-3 py-1.5 rounded-xl border flex-row items-center"
                        style={{ backgroundColor: activeColors.brand, borderColor: 'transparent' }}
                      >
                        <ExternalLink size={13} color="#FFFFFF" />
                        <Text className="text-white font-bold text-xs ml-1">Pay Page</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Create New Alias Input */}
                  {aliases.length === 0 && (
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Input
                          value={aliasHandle}
                          onChangeText={setAliasHandle}
                          placeholder="Choose alias (e.g. amina)"
                          icon="user"
                        />
                      </View>
                      <Button
                        title={generatingAlias ? '...' : 'Generate @Alias'}
                        onPress={handleCreateAlias}
                        loading={generatingAlias}
                        variant="primary"
                        size="md"
                        style={{ height: 48, marginTop: 0 }}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* 4. ADMIN SIMULATION TOGGLE */}
            <Divider spacing={tokens.spacing.lg} />
            <View>
              <Text className="font-mono text-xs uppercase mb-2" style={{ color: activeColors.text.muted }}>
                Developer Review Simulation
              </Text>
              <View className="flex-row gap-2">
                <Button
                  title="Approve ID"
                  variant="success"
                  size="sm"
                  onPress={() => handleAdminReview('approved')}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Reject ID"
                  variant="danger"
                  size="sm"
                  onPress={() => handleAdminReview('rejected')}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </Card>
        )}

        {/* 5. PUBLIC ALIAS RESOLUTION TEST FOR PAYERS */}
        <Card>
          <Text className="font-bold text-base mb-1" style={{ color: activeColors.text.primary }}>
            Public Payer Alias Lookup (§18)
          </Text>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 14 }}>
            Unauthenticated endpoint for looking up recipient details at checkout or QR scan.
          </Text>

          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Input
                value={lookupHandle}
                onChangeText={setLookupHandle}
                placeholder="Search @alias (e.g. @amina)"
                icon="search"
              />
            </View>
            <Button
              title={lookingUp ? 'Searching...' : 'Lookup'}
              onPress={handleLookup}
              loading={lookingUp}
              variant="secondary"
              size="md"
              style={{ height: 48 }}
            />
          </View>

          {lookupResult && (
            <View
              className="p-4 rounded-xl border mt-1"
              style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
            >
              {lookupResult.error ? (
                <Text className="text-xs font-mono" style={{ color: tokens.colors.semantic.error }}>
                  {lookupResult.error}
                </Text>
              ) : (
                <View>
                  <View className="flex-row items-center mb-1">
                    <CheckCircle2 size={14} color={tokens.colors.semantic.success} />
                    <Text className="ml-1.5 font-bold text-xs" style={{ color: tokens.colors.semantic.success }}>
                      Verified Recipient Found
                    </Text>
                  </View>
                  <Text className="font-bold text-base" style={{ color: activeColors.text.primary }}>
                    {lookupResult.recipient?.display_name}
                  </Text>
                  <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs }}>
                    Legal Name: {lookupResult.recipient?.owner_name} · Type: {lookupResult.recipient?.account_type}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push(`/pay/${lookupResult.alias?.alias?.replace(/^@/, '')}`)}
                    className="mt-3 py-2 px-3 rounded-lg flex-row items-center justify-between border"
                    style={{ backgroundColor: isDark ? '#1e293b' : '#eff6ff', borderColor: activeColors.border }}
                  >
                    <Text className="font-mono text-xs font-bold" style={{ color: activeColors.brand }}>
                      Open Checkout for {lookupResult.alias?.alias}
                    </Text>
                    <ChevronRight size={14} color={activeColors.brand} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
