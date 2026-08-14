import { createProfile, submitIdentity, reviewIdentity } from '../services/profileService';
import { createAlias } from '../services/aliasService';
import { createOrUpdateAdminUser } from '../services/adminService';
import { recordTransaction } from '../services/transactionService';
import { createPayout } from '../services/payoutService';
import { setMoneyDirectionRules } from '../services/moneyDirectionService';
import { saveReconciliationException } from '../services/reconciliationService';
import { rootLogger } from '../utils/logger';

export interface SeededDemoDataResult {
  aminaProfile: any;
  kenProfile: any;
  freshBitesProfile: any;
  unverifiedIndProfile: any;
  admins: any[];
  transactionsCount: number;
  payoutsCount: number;
}

export async function seedDemoData(): Promise<SeededDemoDataResult> {
  rootLogger.info('Starting Phase 10 Demo Data Seeding...');

  // 1. Admin Accounts (§16 RBAC)
  const superAdmin = await createOrUpdateAdminUser({
    clerk_user_id: 'admin_super',
    role: 'super_admin',
  });

  const supportAdmin = await createOrUpdateAdminUser({
    clerk_user_id: 'admin_support',
    role: 'support',
  });

  const complianceAdmin = await createOrUpdateAdminUser({
    clerk_user_id: 'admin_compliance',
    role: 'compliance_reviewer',
  });

  // 2. Amina Profile (Verified Business) — §27 Primary Presenter Persona
  const aminaProfile = await createProfile({
    clerk_user_id: 'user_amina',
    account_type: 'business',
    display_name: "Amina's Organic Hub",
    owner_name: 'Amina Mohamed',
    email: 'amina@organichub.co.ke',
    phone: '254712345678',
    currency: 'KES',
    country_code: 'KE',
  });

  await submitIdentity(aminaProfile.id, {
    id_number: 'ID-29481039',
    id_document_url: 'https://docs.unipay.ke/samples/amina_national_id.pdf',
    id_selfie_url: 'https://docs.unipay.ke/samples/amina_selfie.jpg',
  });

  await reviewIdentity(aminaProfile.id, {
    decision: 'approved',
    reviewer_note: 'Verified national ID and business registry documents via compliance queue',
  });

  await createAlias({
    profile_id: aminaProfile.id,
    alias: '@amina',
  });

  // 3. Ken Profile (Verified Individual) — §27 P2P Sender Persona
  const kenProfile = await createProfile({
    clerk_user_id: 'user_ken',
    account_type: 'individual',
    display_name: 'Ken Njoroge',
    owner_name: 'Ken Njoroge',
    email: 'ken.njoroge@gmail.com',
    phone: '254722998877',
    currency: 'KES',
    country_code: 'KE',
  });

  await submitIdentity(kenProfile.id, {
    id_number: 'ID-31029481',
    id_document_url: 'https://docs.unipay.ke/samples/ken_national_id.pdf',
  });

  await reviewIdentity(kenProfile.id, {
    decision: 'approved',
    reviewer_note: 'Verified national ID credentials',
  });

  await createAlias({
    profile_id: kenProfile.id,
    alias: '@ken',
  });

  // 4. Unverified Business Profile (Fresh Bites) — §27 Pending Review Persona
  const freshBitesProfile = await createProfile({
    clerk_user_id: 'user_freshbites',
    account_type: 'business',
    display_name: 'Fresh Bites Cafe',
    owner_name: 'David Ochieng',
    email: 'david@freshbites.co.ke',
    phone: '254733445566',
    currency: 'KES',
    country_code: 'KE',
  });

  await submitIdentity(freshBitesProfile.id, {
    id_number: 'ID-44556677',
    id_document_url: 'https://docs.unipay.ke/samples/freshbites_id.pdf',
  });
  // Left unreviewed (verification_status = 'pending') for compliance review queue demo

  await createAlias({
    profile_id: freshBitesProfile.id,
    alias: '@freshbites',
  });

  // 5. Unverified Individual Profile — §27 Incomplete State Persona
  const unverifiedIndProfile = await createProfile({
    clerk_user_id: 'user_unverified_ind',
    account_type: 'individual',
    display_name: 'Sarah Wanjiku (Pending KYC)',
    owner_name: 'Sarah Wanjiku',
    email: 'sarah.wanjiku@outlook.com',
    phone: '254700112233',
    currency: 'KES',
    country_code: 'KE',
  });

  await submitIdentity(unverifiedIndProfile.id, {
    id_number: 'ID-55667788',
    id_document_url: 'https://docs.unipay.ke/samples/sarah_id.pdf',
  });

  await createAlias({
    profile_id: unverifiedIndProfile.id,
    alias: '@unverified_ind',
  });

  // 6. Seed Historical Transactions with Realistic Variety (§8)
  let transactionsCount = 0;

  // Amina Transactions (LOOP & Seeded Rails)
  const aminaTxData = [
    { amount: 5000, provider: 'loop', rail: 'loop', status: 'successful', payer: '254722998877', daysAgo: 5 },
    { amount: 12500, provider: 'loop', rail: 'loop', status: 'successful', payer: '254711223344', daysAgo: 4 },
    { amount: 3200, provider: 'seeded', rail: 'request_to_pay', status: 'successful', payer: '254788990011', daysAgo: 3 },
    { amount: 800, provider: 'loop', rail: 'loop', status: 'initiated', payer: '254733112233', daysAgo: 2 },
    { amount: 15000, provider: 'loop', rail: 'loop', status: 'successful', payer: '254799001122', daysAgo: 1 },
    { amount: 4500, provider: 'seeded_2', rail: 'request_to_pay', status: 'successful', payer: '254700998877', currency: 'KES', daysAgo: 1 },
    { amount: 2100, provider: 'seeded', rail: 'request_to_pay', status: 'failed', payer: '254755443322', daysAgo: 0 },
  ];

  for (const t of aminaTxData) {
    const txTime = new Date(Date.now() - t.daysAgo * 86400000).toISOString();
    const fee = Math.round(t.amount * 0.005 * 100) / 100;
    await recordTransaction(
      {
        provider: t.provider,
        rail: t.rail,
        internal_reference: `INT_SEED_${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        external_reference: `EXT_LOOP_${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        amount: t.amount,
        currency: t.currency || 'KES',
        provider_fee: fee,
        net_amount: t.amount - fee,
        payer_identifier: t.payer,
        payment_status: t.status as any,
        settlement_status: t.status === 'successful' ? 'settled' : 'pending',
        refund_status: 'none',
        transaction_time: txTime,
        raw_payload: { simulated: true, demo_seed: true },
      },
      aminaProfile.id
    );
    transactionsCount++;
  }

  // Ken Transactions (P2P Sends)
  const kenTxData = [
    { amount: 1500, provider: 'loop', rail: 'loop', status: 'successful', payer: '254722998877', daysAgo: 4 },
    { amount: 4500, provider: 'loop', rail: 'loop', status: 'successful', payer: '254722998877', daysAgo: 2 },
  ];

  for (const t of kenTxData) {
    const txTime = new Date(Date.now() - t.daysAgo * 86400000).toISOString();
    const fee = Math.round(t.amount * 0.015 * 100) / 100;
    await recordTransaction(
      {
        provider: t.provider,
        rail: t.rail,
        internal_reference: `INT_KEN_${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        external_reference: `EXT_KEN_${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        amount: t.amount,
        currency: 'KES',
        provider_fee: fee,
        net_amount: t.amount - fee,
        payer_identifier: t.payer,
        payment_status: t.status as any,
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: txTime,
        raw_payload: { simulated: true, demo_seed: true },
      },
      kenProfile.id
    );
    transactionsCount++;
  }

  // 7. Seed Historical Payouts (§8)
  let payoutsCount = 0;
  const payoutsToSeed = [
    { profile_id: aminaProfile.id, amount: 10000, currency: 'KES', dest: 'NCBA-***1023', status: 'completed' },
    { profile_id: aminaProfile.id, amount: 5000, currency: 'KES', dest: 'M-Pesa 254712345678', status: 'processing' },
    { profile_id: aminaProfile.id, amount: 2500, currency: 'KES', dest: 'Co-op Bank - ***5541', status: 'failed' },
    { profile_id: kenProfile.id, amount: 1200, currency: 'KES', dest: 'M-Pesa 254722998877', status: 'completed' },
  ];

  for (const p of payoutsToSeed) {
    await createPayout({
      profile_id: p.profile_id,
      amount: p.amount,
      currency: p.currency,
      destination_type: p.dest.startsWith('M-Pesa') ? 'mobile_wallet' : 'bank_account',
      destination_reference: p.dest,
      idempotency_key: `IDEMP_SEED_PAYOUT_${Math.random().toString(36).slice(2, 10)}`,
    });
    payoutsCount++;
  }

  // 8. Money Direction Rules for Amina (§6 Split Settlement)
  await setMoneyDirectionRules(aminaProfile.id, [
    {
      destination_type: 'bank_account',
      destination_reference: 'NCBA Bank - 884910234',
      allocation_type: 'percentage',
      allocation_value: 70,
      priority_order: 1,
      is_active: true,
    },
    {
      destination_type: 'vault',
      destination_reference: 'UniPay KES Tax Reserve Pool',
      allocation_type: 'percentage',
      allocation_value: 30,
      priority_order: 2,
      is_active: true,
    },
  ]);

  // 9. Seed Reconciliation Exceptions (§8, §14)
  await saveReconciliationException({
    profile_id: aminaProfile.id,
    category: 'amount_mismatch',
    details: {
      transaction_id: 'tx_seed_amount_mismatch_101',
      expected_amount: 15000,
      actual_amount: 14850,
      currency: 'KES',
      payer: '254799001122',
      reason: 'Fuzzy match AI analysis detected 1% fee deduction by intermediary bank gateway.',
      ai_explanation: 'AI match confidence 94%: Transaction amount 14,850 KES corresponds to Order #8841 (15,000 KES) after deducting 150 KES bank processing fee.',
    },
  });

  await saveReconciliationException({
    profile_id: aminaProfile.id,
    category: 'fee_mismatch',
    details: {
      transaction_id: 'tx_seed_fee_mismatch_102',
      rail: 'loop',
      amount: 12500,
      actual_fee: 250,
      expected_fee: 187.50,
      difference: 62.50,
      reason: 'Fee mismatch on loop: charged 250 KES, expected 187.50 KES.',
    },
  });

  rootLogger.info('Phase 10 Demo Data Seeding Completed Successfully!', {
    transactionsCount,
    payoutsCount,
  });

  const { getProfileById } = await import('../services/profileService');

  return {
    aminaProfile: (await getProfileById(aminaProfile.id)) || aminaProfile,
    kenProfile: (await getProfileById(kenProfile.id)) || kenProfile,
    freshBitesProfile: (await getProfileById(freshBitesProfile.id)) || freshBitesProfile,
    unverifiedIndProfile: (await getProfileById(unverifiedIndProfile.id)) || unverifiedIndProfile,
    admins: [superAdmin, supportAdmin, complianceAdmin],
    transactionsCount,
    payoutsCount,
  };
}

// Allow direct CLI execution: `npx tsx backend/src/scripts/seed-demo-data.ts`
if (require.main === module) {
  seedDemoData()
    .then((res) => {
      console.log('✅ Demo data successfully seeded!');
      console.log(`- Amina Profile ID: ${res.aminaProfile.id}`);
      console.log(`- Ken Profile ID: ${res.kenProfile.id}`);
      console.log(`- FreshBites Profile ID: ${res.freshBitesProfile.id}`);
      console.log(`- Transactions Seeded: ${res.transactionsCount}`);
      console.log(`- Payouts Seeded: ${res.payoutsCount}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error seeding demo data:', err);
      process.exit(1);
    });
}
