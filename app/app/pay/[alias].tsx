import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CheckoutCard } from '../../components/checkout/CheckoutCard';

export default function PayAliasScreen() {
  const { alias, amount } = useLocalSearchParams<{ alias?: string; amount?: string }>();

  const cleanAlias = typeof alias === 'string' ? alias : (Array.isArray(alias) ? alias[0] : '');
  const initialAmount = amount ? parseFloat(amount) : undefined;

  return (
    <CheckoutCard
      alias={cleanAlias}
      initialAmount={initialAmount}
    />
  );
}
