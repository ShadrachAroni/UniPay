/**
 * UniPay Design System Tokens
 * Ground truth: Frontend Conventions & UI Polish (Handbook) + §20
 */

export const colors = {
  // Backgrounds & Surface
  bgDark: '#0B0F19',
  bgCard: '#131C2E',
  bgCardHover: '#1B263B',
  bgCardSubtle: '#0F172A',
  bgInput: '#1E293B',

  // Borders
  border: '#24334C',
  borderFocus: '#3B82F6',
  borderSubtle: '#1E293B',

  // Typography
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0B0F19',

  // Brand / Accents
  brand: '#2563EB',
  brandHover: '#1D4ED8',
  brandLight: '#3B82F6',
  brandGlow: 'rgba(59, 130, 246, 0.15)',

  // Semantic Status
  verified: '#10B981', // Verified checkmark green per §5
  verifiedBg: 'rgba(16, 185, 129, 0.12)',
  verifiedBorder: 'rgba(16, 185, 129, 0.3)',

  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',

  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.12)',

  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.12)',
};

export const typography = {
  fontSans: 'System, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontDisplay: 'System, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',

  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
};

export const layout = {
  maxWidth: 480, // Max width for mobile-first checkout container
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
