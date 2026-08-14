import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// BACKEND TODO: replace with real Clerk session + JWT-derived profile (Phase 1) once auth is live. Server MUST independently verify account_type and admin_role via JWT claims — this client context is for UI branching only, never trust it for access control.

export type Profile = {
  id: string;
  account_type: 'individual' | 'business';
  display_name: string;
  owner_name: string;
  business_name?: string;
  verification_status: 'unsubmitted' | 'submitted' | 'verified' | 'rejected';
  admin_role?: 'super_admin' | 'support' | 'compliance_reviewer' | null;
};

export const MOCK_PROFILES: Profile[] = [
  {
    id: 'profile_individual_1',
    account_type: 'individual',
    display_name: 'Alex Johnson',
    owner_name: 'Alex Johnson',
    verification_status: 'verified',
    admin_role: null,
  },
  {
    id: 'profile_business_1',
    account_type: 'business',
    display_name: 'Acme Enterprises',
    owner_name: 'Sarah Jenkins',
    business_name: 'Acme Enterprises',
    verification_status: 'verified',
    admin_role: null,
  },
  {
    id: 'profile_admin_1',
    account_type: 'business',
    display_name: 'UniPay Global Ltd',
    owner_name: 'Shadrach Aroni',
    business_name: 'UniPay Global Ltd',
    verification_status: 'verified',
    admin_role: 'super_admin',
  },
];

interface AuthContextType {
  token: string | null;
  profile: Profile | null;
  isAdmin: boolean;
  setMockProfile: (profile: Profile) => void;
  signIn: (token: string, profile: any) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@unipay_auth_token';
const PROFILE_KEY = '@unipay_auth_profile';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    async function loadAuth() {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);

        if (storedToken && storedProfile) {
          setToken(storedToken);
          setProfile(JSON.parse(storedProfile));
        } else {
          // Default initial state for dev testing
          setToken('mock_token_dev');
          setProfile(MOCK_PROFILES[2]); // Default to Super Admin
        }
      } catch (e) {
        console.error('Failed to load auth state', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'verify' || segments[0] === 'checkout';

    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, segments, isLoading]);

  const signIn = async (newToken: string, newProfile: Profile) => {
    setToken(newToken);
    setProfile(newProfile);
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
  };

  const signOut = async () => {
    setToken(null);
    setProfile(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(PROFILE_KEY);
  };

  const setMockProfile = useCallback((newProfile: Profile) => {
    setProfile(newProfile);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile)).catch(() => {});
  }, []);

  const isAdmin = profile?.admin_role != null;

  return (
    <AuthContext.Provider 
      value={{ 
        token, 
        profile, 
        isAdmin, 
        setMockProfile, 
        signIn, 
        signOut, 
        isLoading 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
