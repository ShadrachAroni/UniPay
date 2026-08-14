import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../components/AuthProvider';

export default function Index() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}
