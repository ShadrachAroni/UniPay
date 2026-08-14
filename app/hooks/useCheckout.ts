import { useState, useEffect, useCallback, useRef } from 'react';

export interface RecipientProfile {
  profile_id: string;
  display_name: string;
  owner_name: string;
  account_type: 'individual' | 'business';
  verification_status: string;
  currency: string;
  is_verified?: boolean;
}

export interface PaymentOption {
  provider: string;
  rail: string;
  amount: number;
  currency: string;
  estimated_fee: number;
  estimated_recipient_amount: number;
  settlement_estimate: string;
  recipient: {
    display_name: string;
    account_type: string;
    alias: string;
  };
}

export interface PaymentIntentResult {
  id: string;
  idempotency_key: string;
  recipient_profile_id: string;
  recipient_alias?: string;
  amount: number;
  currency: string;
  rail: string;
  status?: string;
  payment_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed' | 'partially_refunded' | string;
  provider_reference?: string;
  created_at: string;
  updated_at: string;
}

export type CheckoutStep = 'alias_lookup' | 'amount_entry' | 'awaiting_payment' | 'completed' | 'failed';

export interface UseCheckoutProps {
  alias: string;
  initialAmount?: number;
  apiBaseUrl?: string;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

export function useCheckout({ alias, initialAmount, apiBaseUrl }: UseCheckoutProps) {
  const apiUrl = apiBaseUrl || process.env.EXPO_PUBLIC_API_URL;

  // Core checkout state
  const [step, setStep] = useState<CheckoutStep>('alias_lookup');
  const [loadingRecipient, setLoadingRecipient] = useState<boolean>(true);
  const [recipient, setRecipient] = useState<RecipientProfile | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  // Amount & Options state
  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '');
  const [payerPhone, setPayerPhone] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<PaymentOption | null>(null);
  const [loadingOption, setLoadingOption] = useState<boolean>(false);
  const [optionError, setOptionError] = useState<string | null>(null);

  // Payment Intent & Polling state
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentResult | null>(null);
  const [initiatingPayment, setInitiatingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [retryingPayment, setRetryingPayment] = useState<boolean>(false);

  // In-memory idempotency key (stable across retries)
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  // 1. Resolve Alias
  const fetchRecipient = useCallback(async () => {
    if (!apiUrl) {
      setRecipientError('Missing EXPO_PUBLIC_API_URL environment variable.');
      setLoadingRecipient(false);
      return;
    }

    if (!alias) {
      setRecipientError('Alias parameter is required');
      setLoadingRecipient(false);
      return;
    }

    setLoadingRecipient(true);
    setRecipientError(null);

    const cleanAlias = alias.startsWith('@') ? alias : `@${alias}`;

    try {
      const res = await fetch(`${apiUrl}/api/v1/aliases/${encodeURIComponent(cleanAlias)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setRecipientError(`Merchant with alias '${cleanAlias}' not found or inactive`);
        } else {
          setRecipientError('Failed to resolve merchant alias. Please try again.');
        }
        setRecipient(null);
        return;
      }

      const data = await res.json();
      const rec: RecipientProfile = {
        profile_id: data.recipient.profile_id,
        display_name: data.recipient.display_name,
        owner_name: data.recipient.owner_name,
        account_type: data.recipient.account_type,
        verification_status: data.recipient.verification_status,
        currency: data.recipient.currency || 'KES',
        is_verified: data.alias?.is_verified || data.recipient.verification_status === 'approved',
      };

      setRecipient(rec);
      setStep('amount_entry');
    } catch (err: any) {
      setRecipientError('Network error connecting to payment gateway');
    } finally {
      setLoadingRecipient(false);
    }
  }, [alias, apiUrl]);

  useEffect(() => {
    fetchRecipient();
  }, [fetchRecipient]);

  // 2. Fetch Fee Transparency Options on Amount Change (§13)
  const fetchPaymentOptions = useCallback(
    async (amtValue: string) => {
      if (!apiUrl) {
        setOptionError('Missing EXPO_PUBLIC_API_URL environment variable.');
        setPaymentOption(null);
        return;
      }

      const numAmt = parseFloat(amtValue);
      if (isNaN(numAmt) || numAmt <= 0) {
        setPaymentOption(null);
        setOptionError(null);
        return;
      }

      setLoadingOption(true);
      setOptionError(null);

      try {
        const res = await fetch(`${apiUrl}/api/v1/checkout/payment-options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alias: alias.startsWith('@') ? alias : `@${alias}`,
            amount: numAmt,
            currency: 'KES',
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setOptionError(errData.message || 'Unable to estimate fee for this amount');
          setPaymentOption(null);
          return;
        }

        const data: PaymentOption = await res.json();
        setPaymentOption(data);
      } catch (err: any) {
        setOptionError('Failed to calculate fee breakdown');
      } finally {
        setLoadingOption(false);
      }
    },
    [alias, apiUrl]
  );

  const handleAmountChange = (val: string) => {
    setAmount(val);
    fetchPaymentOptions(val);
  };

  // 3. Payment Polling Routine
  const pollPaymentStatus = useCallback(
    async (intentId: string) => {
      if (!isMountedRef.current) return;

      if (!apiUrl) {
        setPaymentError('Missing EXPO_PUBLIC_API_URL environment variable.');
        return;
      }

      try {
        const res = await fetch(`${apiUrl}/api/v1/payment-intents/${intentId}`);
        if (res.ok) {
          const data: PaymentIntentResult = await res.json();
          setPaymentIntent(data);

          const currentStatus = data.payment_status || data.status;
          if (currentStatus === 'completed') {
            setStep('completed');
            return;
          }

          if (currentStatus === 'failed') {
            setStep('failed');
            setPaymentError('Payment was declined or timed out on your phone');
            return;
          }
        }
      } catch {
        // Continue polling on transient error
      }

      // Schedule next poll
      pollingTimerRef.current = setTimeout(() => {
        pollPaymentStatus(intentId);
      }, 2500);
    },
    [apiUrl]
  );

  // 4. Initiate Payment Intent
  const initiatePayment = async () => {
    if (!apiUrl) {
      setPaymentError('Missing EXPO_PUBLIC_API_URL environment variable.');
      return;
    }

    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setPaymentError('Please enter a valid payment amount');
      return;
    }

    setInitiatingPayment(true);
    setPaymentError(null);

    const orderRef = 'ORD_' + Date.now().toString(36).toUpperCase();

    try {
      const res = await fetch(`${apiUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          alias: alias.startsWith('@') ? alias : `@${alias}`,
          order_reference: orderRef,
          amount: numAmt,
          currency: 'KES',
          payer_phone: payerPhone.trim() || undefined,
          idempotency_key: idempotencyKeyRef.current,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPaymentError(err.message || 'Failed to initiate payment intent');
        setInitiatingPayment(false);
        return;
      }

      const data: PaymentIntentResult = await res.json();
      setPaymentIntent(data);

      const currentStatus = data.payment_status || data.status;
      if (currentStatus === 'completed') {
        setStep('completed');
      } else if (currentStatus === 'failed') {
        setStep('failed');
        setPaymentError('Payment could not be completed');
      } else {
        setStep('awaiting_payment');
        pollPaymentStatus(data.id);
      }
    } catch (err: any) {
      setPaymentError('Network connection failed. Please check your internet.');
    } finally {
      setInitiatingPayment(false);
    }
  };

  // 5. Retry Payment Intent on Failure (reuses same intent & key)
  const retryPayment = async () => {
    if (!apiUrl) {
      setPaymentError('Missing EXPO_PUBLIC_API_URL environment variable.');
      return;
    }

    if (!paymentIntent?.id) {
      // Re-initiate if no intent exists
      initiatePayment();
      return;
    }

    setRetryingPayment(true);
    setPaymentError(null);

    try {
      const res = await fetch(`${apiUrl}/api/v1/payment-intents/${paymentIntent.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data: PaymentIntentResult = await res.json();
        setPaymentIntent(data);

        const currentStatus = data.payment_status || data.status;
        if (currentStatus === 'completed') {
          setStep('completed');
        } else if (currentStatus === 'failed') {
          setPaymentError('Payment retry failed or was rejected. Please try again.');
        } else {
          setStep('awaiting_payment');
          pollPaymentStatus(data.id);
        }
      } else {
        setPaymentError('Retry request could not be processed');
      }
    } catch (err: any) {
      setPaymentError('Network error retrying payment');
    } finally {
      setRetryingPayment(false);
    }
  };

  // Reset checkout back to amount entry
  const resetCheckout = () => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
    }
    idempotencyKeyRef.current = generateIdempotencyKey();
    setPaymentIntent(null);
    setPaymentError(null);
    setStep('amount_entry');
  };

  return {
    step,
    recipient,
    loadingRecipient,
    recipientError,
    amount,
    payerPhone,
    setPayerPhone,
    handleAmountChange,
    paymentOption,
    loadingOption,
    optionError,
    paymentIntent,
    initiatingPayment,
    retryingPayment,
    paymentError,
    idempotencyKey: idempotencyKeyRef.current,
    fetchRecipient,
    initiatePayment,
    retryPayment,
    resetCheckout,
  };
}
