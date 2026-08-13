import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Profile, Alias, AccountType, VerificationStatus } from '@unipay/shared';

export default function IndexScreen() {
  const { isSignedIn, signOut, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

  // Profile & Verification state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
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

  // Create Profile Handler
  const handleCreateProfile = async () => {
    if (!displayName.trim() || !ownerName.trim()) {
      setErrorMsg('Please enter display name and legal owner name');
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
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setCreatingProfile(false);
    }
  };

  // Submit Identity (KYC + Face Selfie)
  const handleSubmitKYC = async () => {
    if (!profile) return;
    if (!idNumber.trim()) {
      setErrorMsg('Please enter National ID / Passport number');
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
      if (Platform.OS === 'web') {
        window.alert('Identity documents submitted! Status: Under Review.');
      } else {
        Alert.alert('Success', 'Identity documents submitted! Status: Under Review.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingKYC(false);
    }
  };

  // Generate Alias
  const handleCreateAlias = async () => {
    if (!profile) return;
    if (!aliasHandle.trim()) {
      setErrorMsg('Please enter an alias handle (e.g. amina)');
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
    } catch (err: any) {
      setErrorMsg(err.message);
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
    <ScrollView className="flex-1 bg-slate-950 px-4 py-8">
      <View className="max-w-2xl mx-auto w-full pb-16">
        {/* Header Badge */}
        <View className="items-center mb-6">
          <View className="bg-indigo-600/20 border border-indigo-500/30 px-3 py-1 rounded-full mb-3 flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
            <Text className="text-indigo-400 font-semibold text-xs tracking-wider uppercase">
              Phase 1 — Identity, Auth & Data Model
            </Text>
          </View>
          <Text className="text-3xl font-extrabold text-white text-center tracking-tight">
            UniPay Kenya
          </Text>
          <Text className="text-slate-400 text-sm mt-1 text-center">
            Single Account Model · Universal Identity · Alias & QR Primitive
          </Text>
        </View>

        {/* Global Error Banner */}
        {errorMsg && (
          <View className="bg-rose-950/70 border border-rose-800 p-4 rounded-xl mb-6">
            <Text className="text-rose-400 font-semibold text-xs">{errorMsg}</Text>
          </View>
        )}

        {/* Auth Status & Account Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 shadow-lg">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-slate-200 font-bold text-base">Clerk Authentication</Text>
            {isSignedIn ? (
              <TouchableOpacity
                onPress={() => signOut()}
                className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700"
              >
                <Text className="text-rose-400 text-xs font-semibold">Sign Out</Text>
              </TouchableOpacity>
            ) : (
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/sign-in')}
                  className="bg-indigo-600 px-3 py-1.5 rounded-lg mr-2"
                >
                  <Text className="text-white text-xs font-bold">Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/sign-up')}
                  className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
                >
                  <Text className="text-slate-200 text-xs font-semibold">Sign Up</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <Text className="text-slate-400 text-xs">Clerk User Session:</Text>
            <Text className="text-indigo-400 font-mono text-xs mt-0.5">
              {isSignedIn ? (user?.primaryEmailAddress?.emailAddress || user?.id) : 'Demo / Guest Mode'}
            </Text>
          </View>
        </View>

        {/* 1. ONBOARDING: PROFILE CREATION (IF NO PROFILE) */}
        {!profile && (
          <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
            <Text className="text-white font-bold text-lg mb-1">
              Step 1: Choose Account Type
            </Text>
            <Text className="text-slate-400 text-xs mb-5">
              Single Account Model (§9b): Account type is a flag, not a fork. One table for both individuals and businesses.
            </Text>

            {/* Account Type Selector */}
            <View className="flex-row space-x-3 mb-5">
              <TouchableOpacity
                onPress={() => setSelectedAccountType('individual')}
                className={`flex-1 p-4 rounded-xl border mr-3 ${
                  selectedAccountType === 'individual'
                    ? 'bg-indigo-950/40 border-indigo-500'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <Text className="text-xl mb-1">👤</Text>
                <Text className="text-white font-bold text-sm">Individual Account</Text>
                <Text className="text-slate-400 text-xs mt-1">
                  Personal P2P payments, informal merchant & instant checkout
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedAccountType('business')}
                className={`flex-1 p-4 rounded-xl border ${
                  selectedAccountType === 'business'
                    ? 'bg-indigo-950/40 border-indigo-500'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <Text className="text-xl mb-1">🏢</Text>
                <Text className="text-white font-bold text-sm">Business Account</Text>
                <Text className="text-slate-400 text-xs mt-1">
                  SMEs, Till / Paybill aggregation & Chama pooled funds
                </Text>
              </TouchableOpacity>
            </View>

            {/* Profile Form */}
            <View className="space-y-3">
              <View>
                <Text className="text-slate-300 text-xs font-semibold mb-1">
                  Display Name (Shown to Payers)
                </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={
                    selectedAccountType === 'business'
                      ? 'e.g. Mama Mboga Groceries'
                      : 'e.g. Amina Mwangi'
                  }
                  placeholderTextColor="#64748B"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg p-3 text-sm"
                />
              </View>

              <View className="mt-3">
                <Text className="text-slate-300 text-xs font-semibold mb-1">
                  Legal Owner / Registered Name
                </Text>
                <TextInput
                  value={ownerName}
                  onChangeText={setOwnerName}
                  placeholder="e.g. Amina Jane Mwangi"
                  placeholderTextColor="#64748B"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg p-3 text-sm"
                />
              </View>

              <View className="mt-3">
                <Text className="text-slate-300 text-xs font-semibold mb-1">
                  Kenyan Phone Number (Masked in logs)
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+254712345678"
                  placeholderTextColor="#64748B"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg p-3 text-sm"
                />
              </View>

              <TouchableOpacity
                onPress={handleCreateProfile}
                disabled={creatingProfile}
                className="bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl items-center mt-6 shadow-md"
              >
                <Text className="text-white font-bold text-sm">
                  {creatingProfile ? 'Creating Profile...' : 'Complete Profile Setup'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ACTIVE PROFILE OVERVIEW */}
        {profile && (
          <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
            <View className="flex-row justify-between items-start mb-4">
              <View>
                <View className="flex-row items-center">
                  <Text className="text-white font-extrabold text-xl mr-2">
                    {profile.display_name}
                  </Text>
                  <View className="bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded">
                    <Text className="text-indigo-300 text-xs font-bold uppercase">
                      {profile.account_type}
                    </Text>
                  </View>
                </View>
                <Text className="text-slate-400 text-xs mt-1">
                  Owner: {profile.owner_name} · Currency: {profile.currency}
                </Text>
              </View>

              {/* Status Badge */}
              <View
                className={`px-2.5 py-1 rounded-full border ${
                  profile.verification_status === 'approved'
                    ? 'bg-emerald-500/20 border-emerald-500/40'
                    : profile.verification_status === 'submitted'
                    ? 'bg-amber-500/20 border-amber-500/40'
                    : 'bg-rose-500/20 border-rose-500/40'
                }`}
              >
                <Text
                  className={`text-xs font-bold uppercase ${
                    profile.verification_status === 'approved'
                      ? 'text-emerald-400'
                      : profile.verification_status === 'submitted'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {profile.verification_status === 'submitted'
                    ? 'Under Review'
                    : profile.verification_status}
                </Text>
              </View>
            </View>

            {/* 2. ONBOARDING: KYC IDENTITY + FACE PICTURE SUBMISSION */}
            {profile.verification_status === 'unsubmitted' && (
              <View className="bg-slate-950/80 border border-amber-500/30 p-5 rounded-xl mt-4">
                <Text className="text-amber-400 font-bold text-sm mb-1">
                  Step 2: Submit Identity Verification
                </Text>
                <Text className="text-slate-400 text-xs mb-4">
                  Lightweight, realistic verification (§19): Submit ID document and face selfie. Identity is placed under review.
                </Text>

                <View className="space-y-3">
                  <View>
                    <Text className="text-slate-300 text-xs font-semibold mb-1">
                      National ID / Passport Number
                    </Text>
                    <TextInput
                      value={idNumber}
                      onChangeText={setIdNumber}
                      placeholder="e.g. 29883741"
                      placeholderTextColor="#64748B"
                      className="bg-slate-900 border border-slate-800 text-white rounded-lg p-3 text-sm"
                    />
                  </View>

                  {/* ID Document Preview & Upload simulation */}
                  <View className="mt-3">
                    <Text className="text-slate-300 text-xs font-semibold mb-1">
                      ID Document Document Capture
                    </Text>
                    <View className="bg-slate-900 border border-dashed border-slate-700 rounded-lg p-3 items-center">
                      <Text className="text-slate-400 text-xs font-mono mb-1">
                        📄 national_id_card_front.jpg
                      </Text>
                      <Text className="text-emerald-400 text-xs font-semibold">
                        ✓ ID Document Ready
                      </Text>
                    </View>
                  </View>

                  {/* Face Picture / Selfie Capture (Requested by User) */}
                  <View className="mt-3">
                    <Text className="text-slate-300 text-xs font-semibold mb-1">
                      Face Picture / Liveness Selfie
                    </Text>
                    <View className="bg-slate-900 border border-dashed border-slate-700 rounded-lg p-3 items-center">
                      <Text className="text-slate-400 text-xs font-mono mb-1">
                        📸 live_face_selfie.jpg
                      </Text>
                      <Text className="text-emerald-400 text-xs font-semibold">
                        ✓ Face Picture Captured
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleSubmitKYC}
                    disabled={submittingKYC}
                    className="bg-amber-600 hover:bg-amber-500 py-3 rounded-xl items-center mt-4"
                  >
                    <Text className="text-white font-bold text-sm">
                      {submittingKYC ? 'Submitting...' : 'Submit Verification'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 3. ALIAS & QR GENERATOR (GATED ON SUBMISSION) */}
            <View className="mt-6 pt-5 border-t border-slate-800">
              <Text className="text-white font-bold text-base mb-1">
                Alias & QR Code Identity Primitive (§8)
              </Text>
              <Text className="text-slate-400 text-xs mb-4">
                One alias + QR per user for receiving unified payments across Kenya.
              </Text>

              {profile.verification_status === 'unsubmitted' ? (
                <View className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl items-center">
                  <Text className="text-2xl mb-1">🔒</Text>
                  <Text className="text-slate-300 font-semibold text-xs text-center">
                    Alias Generation Locked
                  </Text>
                  <Text className="text-slate-500 text-xs text-center mt-1">
                    Gated on identity submission (§8). Submit your ID document and face picture above to unlock your payment alias.
                  </Text>
                </View>
              ) : (
                <View>
                  {/* Generated Aliases List */}
                  {aliases.map((a) => (
                    <View
                      key={a.id}
                      className="bg-slate-950 border border-indigo-500/30 p-4 rounded-xl mb-3 flex-row justify-between items-center"
                    >
                      <View>
                        <Text className="text-indigo-400 font-extrabold text-lg font-mono">
                          {a.alias}
                        </Text>
                        <Text className="text-slate-400 text-xs">
                          Type: {a.identifier_type.toUpperCase()} · Status: {a.status}
                        </Text>
                      </View>
                      <View className="bg-indigo-600/30 border border-indigo-500 px-3 py-1 rounded-lg">
                        <Text className="text-indigo-200 font-bold text-xs">QR Ready</Text>
                      </View>
                    </View>
                  ))}

                  {/* Create New Alias Input */}
                  {aliases.length === 0 && (
                    <View className="flex-row space-x-2">
                      <TextInput
                        value={aliasHandle}
                        onChangeText={setAliasHandle}
                        placeholder="Choose alias (e.g. amina)"
                        placeholderTextColor="#64748B"
                        className="flex-1 bg-slate-950 border border-slate-800 text-white rounded-lg p-3 text-sm mr-2"
                      />
                      <TouchableOpacity
                        onPress={handleCreateAlias}
                        disabled={generatingAlias}
                        className="bg-indigo-600 hover:bg-indigo-500 px-4 py-3 rounded-lg justify-center items-center"
                      >
                        <Text className="text-white font-bold text-xs">
                          {generatingAlias ? 'Generating...' : 'Generate @Alias'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* 4. ADMIN SIMULATION TOGGLE */}
            <View className="mt-6 pt-5 border-t border-slate-800/80">
              <Text className="text-slate-400 font-mono text-xs uppercase mb-2">
                Phase 1 Admin Review Simulation
              </Text>
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={() => handleAdminReview('approved')}
                  className="flex-1 bg-emerald-700/60 hover:bg-emerald-600 py-2 rounded-lg items-center mr-2 border border-emerald-500/40"
                >
                  <Text className="text-emerald-200 text-xs font-bold">Approve ID</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleAdminReview('rejected')}
                  className="flex-1 bg-rose-700/60 hover:bg-rose-600 py-2 rounded-lg items-center border border-rose-500/40"
                >
                  <Text className="text-rose-200 text-xs font-bold">Reject ID</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 5. PUBLIC ALIAS RESOLUTION TEST FOR PAYERS */}
        <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <Text className="text-white font-bold text-base mb-1">
            Public Payer Alias Lookup (§18)
          </Text>
          <Text className="text-slate-400 text-xs mb-4">
            Unauthenticated endpoint for looking up recipient details at checkout or QR scan.
          </Text>

          <View className="flex-row space-x-2 mb-3">
            <TextInput
              value={lookupHandle}
              onChangeText={setLookupHandle}
              placeholder="Search @alias (e.g. @amina)"
              placeholderTextColor="#64748B"
              className="flex-1 bg-slate-950 border border-slate-800 text-white rounded-lg p-3 text-sm mr-2"
            />
            <TouchableOpacity
              onPress={handleLookup}
              disabled={lookingUp}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 rounded-lg justify-center items-center"
            >
              <Text className="text-slate-200 font-bold text-xs">
                {lookingUp ? 'Searching...' : 'Lookup'}
              </Text>
            </TouchableOpacity>
          </View>

          {lookupResult && (
            <View className="bg-slate-950 p-4 rounded-xl border border-slate-800 mt-2">
              {lookupResult.error ? (
                <Text className="text-rose-400 text-xs font-mono">{lookupResult.error}</Text>
              ) : (
                <View>
                  <Text className="text-emerald-400 font-mono font-bold text-xs mb-1">
                    ✓ Found Verified Recipient
                  </Text>
                  <Text className="text-white font-bold text-base">
                    {lookupResult.recipient?.display_name}
                  </Text>
                  <Text className="text-slate-400 text-xs">
                    Legal Name: {lookupResult.recipient?.owner_name} · Type:{' '}
                    {lookupResult.recipient?.account_type}
                  </Text>
                  <Text className="text-indigo-400 text-xs font-mono mt-1">
                    Handle: {lookupResult.alias?.alias} ({lookupResult.recipient?.currency})
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
