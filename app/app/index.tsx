import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Profile, Alias, AccountType, MoneyDirectionRule } from '@unipay/shared';
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
  ProfileHeaderSkeleton,
  TransactionListSkeleton,
} from '../components/ui/Skeleton';
import {
  ShieldCheck,
  User,
  Building2,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  Shield,
  CreditCard,
  LogOut,
  Sparkles,
  Send,
  SlidersHorizontal,
  Bot,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Zap,
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
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-step Onboarding State
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>('individual');
  const [displayName, setDisplayName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [creatingProfile, setCreatingProfile] = useState<boolean>(false);

  // Form states for KYC submission (including face picture / selfie)
  const [idNumber, setIdNumber] = useState<string>('');
  const [idDocUrl] = useState<string>(
    'https://storage.unipay.ke/documents/sample_national_id.jpg'
  );
  const [selfieUrl] = useState<string>(
    'https://storage.unipay.ke/selfies/sample_face_selfie.jpg'
  );
  const [submittingKYC, setSubmittingKYC] = useState<boolean>(false);

  // Form states for Alias generation
  const [aliasHandle, setAliasHandle] = useState<string>('');
  const [generatingAlias, setGeneratingAlias] = useState<boolean>(false);

  // AI Natural Language Assistant State
  const [aiQuery, setAiQuery] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<{ summary?: string; confidence?: number; structuredData?: any } | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Payout & Withdrawal State
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutDestType, setPayoutDestType] = useState<'loop' | 'mpesa' | 'bank_account'>('mpesa');
  const [payoutDestRef, setPayoutDestRef] = useState<string>('+254712345678');
  const [payoutLoading, setPayoutLoading] = useState<boolean>(false);

  // Money Direction Rules State
  const [rules, setRules] = useState<MoneyDirectionRule[]>([]);
  const [loadingRules, setLoadingRules] = useState<boolean>(false);
  const [newRuleDestType, setNewRuleDestType] = useState<string>('savings_pot');
  const [newRuleAllocationType, setNewRuleAllocationType] = useState<'percentage' | 'fixed_amount' | 'full'>('percentage');
  const [newRuleValue, setNewRuleValue] = useState<string>('20');
  const [savingRules, setSavingRules] = useState<boolean>(false);

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
        if (data.profile?.id) {
          fetchRules(data.profile.id);
        }
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

  const fetchRules = async (profileId: string) => {
    setLoadingRules(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiUrl}/api/v1/profiles/${profileId}/money-direction/rules`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err: any) {
      console.log('Rules fetch error:', err.message);
    } finally {
      setLoadingRules(false);
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
      setOnboardingStep(2);
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
      setOnboardingStep(3);
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

  // AI Assistant Query Handler
  const handleRunAiQuery = async (customQuery?: string) => {
    const q = customQuery || aiQuery;
    if (!q.trim()) {
      showToast('Please enter a query for the AI Assistant', 'info');
      return;
    }
    setAiLoading(true);
    setAiResponse(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiUrl}/api/v1/ai/query`, {
        method: 'POST',
        headers: {
          ...headers,
          'x-profile-id': profile?.id || '00000000-0000-0000-0000-000000000001',
        },
        body: JSON.stringify({
          query: q.trim(),
          profile_id: profile?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiResponse({
          summary: data.answer || data.summary || data.explanation,
          confidence: data.confidence ?? 0.95,
          structuredData: data.aggregation || data.data,
        });
        showToast('AI financial analysis complete', 'success');
      } else {
        const errData = await res.json();
        setAiResponse({
          summary: errData.message || 'Unable to execute query',
          confidence: 0,
        });
      }
    } catch (err: any) {
      setAiResponse({
        summary: `Error executing AI query: ${err.message}`,
        confidence: 0,
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Payout Request Handler
  const handleRequestPayout = async () => {
    if (!profile) return;
    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid payout amount', 'info');
      return;
    }

    setPayoutLoading(true);
    try {
      const headers = await getAuthHeaders();
      const idempotencyKey = `payout_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const res = await fetch(`${apiUrl}/api/v1/payouts`, {
        method: 'POST',
        headers: {
          ...headers,
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          profile_id: profile.id,
          amount: amountNum,
          currency: 'KES',
          destination_type: payoutDestType,
          destination_reference: payoutDestRef,
          remarks: `UniPay payout via ${payoutDestType.toUpperCase()}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Payout request submitted: KES ${amountNum.toFixed(2)}`, 'success');
        setPayoutAmount('');
      } else {
        showToast(data.message || 'Payout request failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error requesting payout', 'error');
    } finally {
      setPayoutLoading(false);
    }
  };

  // Add / Save Money Direction Rules Handler
  const handleAddRule = async () => {
    if (!profile) return;
    setSavingRules(true);
    try {
      const headers = await getAuthHeaders();
      const newRule: Partial<MoneyDirectionRule> = {
        destination_type: newRuleDestType,
        destination_reference: newRuleDestType === 'mpesa' ? phone : 'ACC-PRIMARY',
        allocation_type: newRuleAllocationType,
        allocation_value: newRuleAllocationType === 'full' ? 100 : parseFloat(newRuleValue) || 20,
        priority_order: rules.length + 1,
        is_active: true,
      };

      const updatedRules = [...rules, newRule];
      const res = await fetch(`${apiUrl}/api/v1/profiles/${profile.id}/money-direction/rules`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          rules: updatedRules,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || updatedRules);
        showToast('Money-direction rule added successfully!', 'success');
      } else {
        const errData = await res.json();
        showToast(errData.message || 'Failed to save rules', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving rule', 'error');
    } finally {
      setSavingRules(false);
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

  // Calculated estimated payout fee
  const getDisbursementFeeEstimate = () => {
    if (payoutDestType === 'loop') return 0;
    if (payoutDestType === 'mpesa') return 15;
    if (payoutDestType === 'bank_account') return 50;
    return 0;
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

        {/* Loading Skeletons */}
        {loadingProfile && (
          <View className="gap-6 mb-6">
            <ProfileHeaderSkeleton />
            <TransactionListSkeleton count={2} />
          </View>
        )}

        {/* Balance & Overview Card */}
        {!loadingProfile && (
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
        )}

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

        {/* 1. ONBOARDING: MULTI-STEP WIZARD (IF NO PROFILE) */}
        {!profile && !loadingProfile && (
          <Card className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                Account Setup Wizard
              </Text>
              <Chip label={`Step ${onboardingStep} of 2`} variant="brand" size="sm" />
            </View>

            {onboardingStep === 1 && (
              <View>
                <Text className="text-xs mb-4" style={{ color: activeColors.text.secondary }}>
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
                    title={creatingProfile ? 'Creating Profile...' : 'Continue to Identity Setup'}
                    onPress={handleCreateProfile}
                    loading={creatingProfile}
                    variant="primary"
                    size="lg"
                    style={{ marginTop: 8 }}
                  />
                </View>
              </View>
            )}
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

            {/* Developer KYC Simulation Quick Toggles */}
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

        {/* ========================================================================= */}
        {/* PARITY WIDGET 1: AI FINANCIAL ASSISTANT & NATURAL-LANGUAGE QUERY BOX      */}
        {/* ========================================================================= */}
        {profile && (
          <Card className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Bot size={20} color={activeColors.brand} />
                <Text className="font-bold ml-2 text-base" style={{ color: activeColors.text.primary }}>
                  AI Financial Assistant (§15)
                </Text>
              </View>
              <Chip label="Claude AI" variant="brand" size="sm" />
            </View>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 14 }}>
              Ask natural-language queries about your earnings, fees, settlement splits, and reconciliation.
            </Text>

            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <Input
                  value={aiQuery}
                  onChangeText={setAiQuery}
                  placeholder="e.g. What were my total fees and gross sales?"
                  icon="search"
                />
              </View>
              <Button
                title={aiLoading ? 'Analyzing...' : 'Ask AI'}
                onPress={() => handleRunAiQuery()}
                loading={aiLoading}
                variant="primary"
                size="md"
                style={{ height: 48 }}
              />
            </View>

            {/* Prompt Suggestion Chips */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              <TouchableOpacity
                onPress={() => {
                  setAiQuery('Summarize my weekly transaction volume');
                  handleRunAiQuery('Summarize my weekly transaction volume');
                }}
                className="px-2.5 py-1 rounded-full border"
                style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
              >
                <Text style={{ color: activeColors.text.secondary, fontSize: 11 }}>
                  ✨ Weekly volume
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setAiQuery('Explain my fee breakdown for last month');
                  handleRunAiQuery('Explain my fee breakdown for last month');
                }}
                className="px-2.5 py-1 rounded-full border"
                style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
              >
                <Text style={{ color: activeColors.text.secondary, fontSize: 11 }}>
                  ✨ Fee analysis
                </Text>
              </TouchableOpacity>
            </View>

            {/* AI Response Card */}
            {aiResponse && (
              <View
                className="p-4 rounded-2xl border"
                style={{
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#eff6ff',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#bfdbfe',
                }}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center">
                    <Sparkles size={14} color={activeColors.brand} />
                    <Text className="ml-1.5 font-bold text-xs" style={{ color: activeColors.brand }}>
                      AI Intelligence Summary
                    </Text>
                  </View>
                  {aiResponse.confidence ? (
                    <Text style={{ color: tokens.colors.semantic.success, fontSize: 11, fontWeight: '600' }}>
                      {(aiResponse.confidence * 100).toFixed(0)}% Confidence
                    </Text>
                  ) : null}
                </View>

                <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm, lineHeight: 20 }}>
                  {aiResponse.summary}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* PARITY WIDGET 2: PAYOUT / WITHDRAWAL REQUEST CARD                          */}
        {/* ========================================================================= */}
        {profile && (
          <Card className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Send size={18} color={activeColors.brand} />
                <Text className="font-bold ml-2 text-base" style={{ color: activeColors.text.primary }}>
                  Withdraw Funds & Payouts (§18)
                </Text>
              </View>
              <Chip label="Instant B2C" variant="success" size="sm" />
            </View>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 16 }}>
              Disburse settled funds directly to your M-Pesa, Bank Account, or LOOP till.
            </Text>

            {/* Destination Type Selectors */}
            <View className="flex-row gap-2 mb-4">
              <TouchableOpacity
                onPress={() => setPayoutDestType('mpesa')}
                className="flex-1 p-3 rounded-xl border items-center"
                style={{
                  backgroundColor: payoutDestType === 'mpesa' ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : activeColors.surfaceSubtle,
                  borderColor: payoutDestType === 'mpesa' ? activeColors.brand : activeColors.border,
                }}
              >
                <Text className="font-bold text-xs" style={{ color: activeColors.text.primary }}>
                  M-Pesa B2C
                </Text>
                <Text style={{ color: activeColors.text.muted, fontSize: 10, marginTop: 2 }}>
                  Fee: KES 15.00
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPayoutDestType('loop')}
                className="flex-1 p-3 rounded-xl border items-center"
                style={{
                  backgroundColor: payoutDestType === 'loop' ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : activeColors.surfaceSubtle,
                  borderColor: payoutDestType === 'loop' ? activeColors.brand : activeColors.border,
                }}
              >
                <Text className="font-bold text-xs" style={{ color: activeColors.text.primary }}>
                  LOOP Account
                </Text>
                <Text style={{ color: tokens.colors.semantic.success, fontSize: 10, marginTop: 2, fontWeight: '600' }}>
                  Fee: KES 0.00 (Free)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPayoutDestType('bank_account')}
                className="flex-1 p-3 rounded-xl border items-center"
                style={{
                  backgroundColor: payoutDestType === 'bank_account' ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : activeColors.surfaceSubtle,
                  borderColor: payoutDestType === 'bank_account' ? activeColors.brand : activeColors.border,
                }}
              >
                <Text className="font-bold text-xs" style={{ color: activeColors.text.primary }}>
                  Bank PesaLink
                </Text>
                <Text style={{ color: activeColors.text.muted, fontSize: 10, marginTop: 2 }}>
                  Fee: KES 50.00
                </Text>
              </TouchableOpacity>
            </View>

            {/* Payout Inputs */}
            <View className="gap-3 mb-4">
              <Input
                label="Amount (KES)"
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                placeholder="e.g. 5000"
                keyboardType="numeric"
                icon="credit-card"
              />

              <Input
                label={payoutDestType === 'bank_account' ? 'Bank Account / Paybill Number' : 'Recipient Mobile Number'}
                value={payoutDestRef}
                onChangeText={setPayoutDestRef}
                placeholder="+254712345678"
                icon="phone"
              />
            </View>

            {/* Fee Breakdown Preview */}
            <View
              className="p-3 rounded-xl border mb-4"
              style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
            >
              <View className="flex-row justify-between mb-1">
                <Text style={{ color: activeColors.text.secondary, fontSize: 11 }}>
                  Requested Amount:
                </Text>
                <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: 11 }}>
                  KES {parseFloat(payoutAmount || '0').toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-1">
                <Text style={{ color: activeColors.text.secondary, fontSize: 11 }}>
                  Disbursement Fee (Centralized Engine):
                </Text>
                <Text className="font-bold" style={{ color: tokens.colors.semantic.error, fontSize: 11 }}>
                  - KES {getDisbursementFeeEstimate().toFixed(2)}
                </Text>
              </View>
              <View className="h-px bg-slate-700/30 my-1.5" />
              <View className="flex-row justify-between">
                <Text className="font-bold" style={{ color: activeColors.text.primary, fontSize: 12 }}>
                  Net Expected Arrival:
                </Text>
                <Text className="font-bold" style={{ color: tokens.colors.semantic.success, fontSize: 12 }}>
                  KES {Math.max(0, parseFloat(payoutAmount || '0') - getDisbursementFeeEstimate()).toFixed(2)}
                </Text>
              </View>
            </View>

            <Button
              title={payoutLoading ? 'Initiating Payout...' : 'Request Instant Payout'}
              onPress={handleRequestPayout}
              loading={payoutLoading}
              variant="primary"
              size="md"
            />
          </Card>
        )}

        {/* ========================================================================= */}
        {/* PARITY WIDGET 3: MONEY DIRECTION & AUTO-SWEEP RULE MANAGER                 */}
        {/* ========================================================================= */}
        {profile && (
          <Card className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <SlidersHorizontal size={18} color={activeColors.brand} />
                <Text className="font-bold ml-2 text-base" style={{ color: activeColors.text.primary }}>
                  Money-Direction Rules (§17)
                </Text>
              </View>
              <Chip label={`${rules.length} Active`} variant="brand" size="sm" />
            </View>
            <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.xs, marginBottom: 16 }}>
              Configure autonomous post-settlement routing (Auto-sweep to Chama, Savings pot, or secondary Till).
            </Text>

            {/* Active Rules List */}
            {rules.length > 0 ? (
              <View className="gap-2 mb-4">
                {rules.map((r, index) => (
                  <View
                    key={r.id || index}
                    className="p-3.5 rounded-xl border flex-row items-center justify-between"
                    style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
                  >
                    <View className="flex-1">
                      <Text className="font-bold text-xs" style={{ color: activeColors.text.primary }}>
                        Rule #{index + 1}: Auto-route {r.allocation_value}% to {r.destination_type.toUpperCase()}
                      </Text>
                      <Text style={{ color: activeColors.text.muted, fontSize: 11, marginTop: 2 }}>
                        Target: {r.destination_reference || 'Default Account'} · Priority: {r.priority_order}
                      </Text>
                    </View>
                    <Chip label="Active" variant="success" size="sm" />
                  </View>
                ))}
              </View>
            ) : (
              <View
                className="p-4 rounded-xl border mb-4 items-center"
                style={{ backgroundColor: activeColors.surfaceSubtle, borderColor: activeColors.border }}
              >
                <Text style={{ color: activeColors.text.muted, fontSize: 12 }}>
                  No active money-direction rules. Settled funds remain in universal balance.
                </Text>
              </View>
            )}

            {/* Add New Rule Form */}
            <View
              className="p-4 rounded-2xl border"
              style={{
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : '#f8fafc',
                borderColor: activeColors.border,
              }}
            >
              <Text className="font-bold text-xs uppercase mb-3" style={{ color: activeColors.brand }}>
                Add Autonomous Rule
              </Text>

              <View className="flex-row gap-2 mb-3">
                <TouchableOpacity
                  onPress={() => setNewRuleDestType('savings_pot')}
                  className="flex-1 p-2.5 rounded-lg border items-center"
                  style={{
                    backgroundColor: newRuleDestType === 'savings_pot' ? activeColors.brand : activeColors.surfaceSubtle,
                    borderColor: activeColors.border,
                  }}
                >
                  <Text
                    className="font-bold text-xs"
                    style={{ color: newRuleDestType === 'savings_pot' ? '#ffffff' : activeColors.text.secondary }}
                  >
                    Savings Pot
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setNewRuleDestType('chama')}
                  className="flex-1 p-2.5 rounded-lg border items-center"
                  style={{
                    backgroundColor: newRuleDestType === 'chama' ? activeColors.brand : activeColors.surfaceSubtle,
                    borderColor: activeColors.border,
                  }}
                >
                  <Text
                    className="font-bold text-xs"
                    style={{ color: newRuleDestType === 'chama' ? '#ffffff' : activeColors.text.secondary }}
                  >
                    Chama Pool
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setNewRuleDestType('mpesa')}
                  className="flex-1 p-2.5 rounded-lg border items-center"
                  style={{
                    backgroundColor: newRuleDestType === 'mpesa' ? activeColors.brand : activeColors.surfaceSubtle,
                    borderColor: activeColors.border,
                  }}
                >
                  <Text
                    className="font-bold text-xs"
                    style={{ color: newRuleDestType === 'mpesa' ? '#ffffff' : activeColors.text.secondary }}
                  >
                    M-Pesa Auto
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row gap-2 items-center mb-3">
                <View className="flex-1">
                  <Input
                    label="Percentage of Inflow (%)"
                    value={newRuleValue}
                    onChangeText={setNewRuleValue}
                    placeholder="e.g. 20"
                    keyboardType="numeric"
                    icon="credit-card"
                  />
                </View>
              </View>

              <Button
                title={savingRules ? 'Saving Rule...' : 'Save Routing Rule'}
                onPress={handleAddRule}
                loading={savingRules}
                variant="secondary"
                size="sm"
              />
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
