import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useUser } from '@clerk/clerk-expo';

export interface DemoPersona {
  id: string;
  name: string;
  role: 'business' | 'individual' | 'super_admin';
  badge: string;
  alias: string;
  description: string;
  avatarColor: string;
  phone: string;
  email: string;
  isAdmin?: boolean;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'user_amina',
    name: 'Amina Mohamed',
    role: 'business',
    badge: 'Verified Business',
    alias: '@amina',
    description: "Amina's Organic Hub · Verified Merchant with Split Rules",
    avatarColor: '#10b981',
    phone: '+254712345678',
    email: 'amina@organichub.co.ke',
  },
  {
    id: 'user_ken',
    name: 'Ken Njoroge',
    role: 'individual',
    badge: 'Verified Individual',
    alias: '@ken',
    description: 'Individual P2P & Instant Request-to-Pay',
    avatarColor: '#3b82f6',
    phone: '+254722998877',
    email: 'ken.njoroge@gmail.com',
  },
  {
    id: 'user_freshbites',
    name: 'David Ochieng',
    role: 'business',
    badge: 'Pending Review',
    alias: '@freshbites',
    description: 'Fresh Bites Cafe · Pending KYC Verification',
    avatarColor: '#f59e0b',
    phone: '+254733445566',
    email: 'david@freshbites.co.ke',
  },
  {
    id: 'user_unverified_ind',
    name: 'Sarah Wanjiku',
    role: 'individual',
    badge: 'Unverified',
    alias: '@unverified_ind',
    description: 'Incomplete State / Onboarding Demo',
    avatarColor: '#8b5cf6',
    phone: '+254700112233',
    email: 'sarah.wanjiku@outlook.com',
  },
  {
    id: 'admin_super',
    name: 'Super Admin',
    role: 'super_admin',
    badge: 'Super Admin',
    alias: '@admin',
    description: 'Full Privileges: Rails, Fees & Interventions',
    avatarColor: '#ef4444',
    phone: '+254700000000',
    email: 'admin.super@unipay.ke',
    isAdmin: true,
  },
  {
    id: 'admin_support',
    name: 'Support Admin',
    role: 'super_admin',
    badge: 'Support Ops',
    alias: '@support',
    description: 'Operations: Exceptions & Customer Logs',
    avatarColor: '#6366f1',
    phone: '+254700000001',
    email: 'admin.support@unipay.ke',
    isAdmin: true,
  },
  {
    id: 'admin_compliance',
    name: 'Compliance Officer',
    role: 'super_admin',
    badge: 'Compliance Reviewer',
    alias: '@compliance',
    description: 'KYC Reviews & Customer Disputes',
    avatarColor: '#ec4899',
    phone: '+254700000002',
    email: 'admin.compliance@unipay.ke',
    isAdmin: true,
  },
];

const STORAGE_KEY = '@unipay_active_persona_id';

interface DemoAuthContextValue {
  currentPersona: DemoPersona;
  allPersonas: DemoPersona[];
  switchPersona: (personaId: string) => Promise<void>;
  getAuthHeaders: (extra?: Record<string, string>) => Promise<Record<string, string>>;
  getAuthToken: () => Promise<string>;
  isDemoMode: boolean;
  isClerkSignedIn: boolean;
  loadingAuth: boolean;
}

const DemoAuthContext = createContext<DemoAuthContextValue | null>(null);

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken, signOut: clerkSignOut } = useAuth();
  const { user } = useUser();
  const [currentPersonaId, setCurrentPersonaId] = useState<string>('user_amina');
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);

  // Restore saved demo persona from storage
  useEffect(() => {
    async function loadSavedPersona() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && DEMO_PERSONAS.some((p) => p.id === saved)) {
          setCurrentPersonaId(saved);
        }
      } catch (err) {
        console.warn('Failed to load saved demo persona:', err);
      } finally {
        setLoadingAuth(false);
      }
    }
    loadSavedPersona();
  }, []);

  const currentPersona =
    DEMO_PERSONAS.find((p) => p.id === currentPersonaId) || DEMO_PERSONAS[0];

  const isDemoMode = !isSignedIn;

  const switchPersona = React.useCallback(
    async (personaId: string) => {
      const target = DEMO_PERSONAS.find((p) => p.id === personaId);
      if (!target) return;

      // If signed into Clerk, sign out so demo persona takes effect
      if (isSignedIn) {
        try {
          await clerkSignOut();
        } catch {}
      }

      setCurrentPersonaId(personaId);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, personaId);
      } catch (err) {
        console.warn('Failed to persist persona:', err);
      }
    },
    [isSignedIn, clerkSignOut]
  );

  const getAuthToken = React.useCallback(async (): Promise<string> => {
    if (isSignedIn) {
      try {
        const token = await getToken();
        if (token) return token;
      } catch {}
    }
    return currentPersona.id;
  }, [isSignedIn, getToken, currentPersona.id]);

  const getAuthHeaders = React.useCallback(
    async (extra: Record<string, string> = {}): Promise<Record<string, string>> => {
      const token = await getAuthToken();
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...extra,
      };
    },
    [getAuthToken]
  );

  const contextValue = React.useMemo(
    () => ({
      currentPersona,
      allPersonas: DEMO_PERSONAS,
      switchPersona,
      getAuthHeaders,
      getAuthToken,
      isDemoMode,
      isClerkSignedIn: !!isSignedIn,
      loadingAuth,
    }),
    [
      currentPersona,
      switchPersona,
      getAuthHeaders,
      getAuthToken,
      isDemoMode,
      isSignedIn,
      loadingAuth,
    ]
  );

  return (
    <DemoAuthContext.Provider value={contextValue}>
      {children}
    </DemoAuthContext.Provider>
  );
}

export function useDemoAuth() {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error('useDemoAuth must be used within a DemoAuthProvider');
  }
  return context;
}
