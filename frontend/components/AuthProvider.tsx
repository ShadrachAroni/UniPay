import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from '../api/types';

interface AuthContextType {
  token: string | null;
  profile: Partial<Profile> | null;
  signIn: (token: string, profile: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Load auth state from storage on mount
    async function loadAuth() {
      try {
        const storedToken = await AsyncStorage.getItem('@unipay_auth_token');
        const storedProfile = await AsyncStorage.getItem('@unipay_auth_profile');
        
        if (storedToken && storedProfile) {
          setToken(storedToken);
          setProfile(JSON.parse(storedProfile));
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

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'verify';

    if (!token && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace('/login');
    } else if (token && inAuthGroup) {
      // Redirect away from the sign-in page.
      router.replace('/(tabs)');
    }
  }, [token, segments, isLoading]);

  const signIn = async (newToken: string, newProfile: Partial<Profile>) => {
    setToken(newToken);
    setProfile(newProfile);
    await AsyncStorage.setItem('@unipay_auth_token', newToken);
    await AsyncStorage.setItem('@unipay_auth_profile', JSON.stringify(newProfile));
  };

  const signOut = async () => {
    setToken(null);
    setProfile(null);
    await AsyncStorage.removeItem('@unipay_auth_token');
    await AsyncStorage.removeItem('@unipay_auth_profile');
  };

  return (
    <AuthContext.Provider value={{ token, profile, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
