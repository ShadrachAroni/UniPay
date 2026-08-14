/**
 * UniPay Design System Tokens
 * Unified Design Tokens ported from dev-d with Light/Dark Mode and Status Schemes
 */

export const tokens = {
  colors: {
    light: {
      brand: '#2563eb', // Primary brand color (blue)
      brandHover: '#1d4ed8',
      brandLight: '#3b82f6',
      brandGlow: 'rgba(37, 99, 235, 0.15)',
      background: '#f8fafc', // App background (slate-50)
      surface: '#ffffff', // Card/Sheet background
      surfaceHover: '#f1f5f9', // slate-100
      surfaceSubtle: '#f8fafc',
      input: '#ffffff',
      text: {
        primary: '#0f172a', // slate-900
        secondary: '#475569', // slate-600
        muted: '#94a3b8', // slate-400
        inverse: '#f8fafc',
      },
      border: '#e2e8f0', // slate-200
      borderFocus: '#2563eb',
      borderSubtle: '#f1f5f9',
    },
    dark: {
      brand: '#3b82f6', // Slightly brighter for dark mode
      brandHover: '#2563eb',
      brandLight: '#60a5fa',
      brandGlow: 'rgba(59, 130, 246, 0.15)',
      background: '#020617', // Very dark slate (slate-950)
      surface: '#0f172a', // Card background (slate-900)
      surfaceHover: '#1e293b', // slate-800
      surfaceSubtle: '#090d16',
      input: '#1e293b',
      text: {
        primary: '#f8fafc', // slate-50
        secondary: '#cbd5e1', // slate-300
        muted: '#64748b', // slate-500
        inverse: '#0f172a',
      },
      border: '#1e293b', // slate-800
      borderFocus: '#3b82f6',
      borderSubtle: '#0f172a',
    },
    status: {
      payment: {
        pending: '#eab308', // Yellow
        pendingBg: 'rgba(234, 179, 8, 0.15)',
        success: '#22c55e', // Green
        successBg: 'rgba(34, 197, 94, 0.15)',
        failed: '#ef4444', // Red
        failedBg: 'rgba(239, 68, 68, 0.15)',
      },
      settlement: {
        pending: '#94a3b8', // Grey
        pendingBg: 'rgba(148, 163, 184, 0.15)',
        processing: '#3b82f6', // Blue
        processingBg: 'rgba(59, 130, 246, 0.15)',
        settled: '#22c55e', // Green
        settledBg: 'rgba(34, 197, 94, 0.15)',
      },
      payout: {
        pending: '#eab308',
        pendingBg: 'rgba(234, 179, 8, 0.15)',
        completed: '#22c55e',
        completedBg: 'rgba(34, 197, 94, 0.15)',
        failed: '#ef4444',
        failedBg: 'rgba(239, 68, 68, 0.15)',
      },
      expectedPayment: {
        open: '#3b82f6', // Blue
        openBg: 'rgba(59, 130, 246, 0.15)',
        partial: '#f59e0b', // Orange-ish yellow
        partialBg: 'rgba(245, 158, 11, 0.15)',
        paid: '#22c55e', // Green
        paidBg: 'rgba(34, 197, 94, 0.15)',
        overdue: '#ef4444', // Red
        overdueBg: 'rgba(239, 68, 68, 0.15)',
        cancelled: '#64748b', // Slate/Grey
        cancelledBg: 'rgba(100, 116, 139, 0.15)',
      },
      pool: {
        open: '#3b82f6',
        openBg: 'rgba(59, 130, 246, 0.15)',
        closed: '#64748b',
        closedBg: 'rgba(100, 116, 139, 0.15)',
        settled: '#22c55e',
        settledBg: 'rgba(34, 197, 94, 0.15)',
      },
    },
    semantic: {
      success: '#22c55e',
      successBg: 'rgba(34, 197, 94, 0.12)',
      warning: '#f59e0b',
      warningBg: 'rgba(245, 158, 11, 0.12)',
      error: '#ef4444',
      errorBg: 'rgba(239, 68, 68, 0.12)',
      info: '#3b82f6',
      infoBg: 'rgba(59, 130, 246, 0.12)',
    },
  },
  typography: {
    fontSans: 'System, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontDisplay: 'System, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    size: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 20,
      xl: 24,
      '2xl': 32,
    },
    weight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
    // Backwards-compatible aliases
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
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 20,
    full: 9999,
  },
  layout: {
    maxWidth: 480,
  },
  elevation: {
    light: {
      card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      },
      floating: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 6,
      },
    },
    dark: {
      card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
      },
      floating: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
      },
    },
  },
} as const;

// Backward-compatible color references
export const colors = {
  bgDark: tokens.colors.dark.background,
  bgCard: tokens.colors.dark.surface,
  bgCardHover: tokens.colors.dark.surfaceHover,
  bgCardSubtle: tokens.colors.dark.surfaceSubtle,
  bgInput: tokens.colors.dark.input,
  border: tokens.colors.dark.border,
  borderFocus: tokens.colors.dark.borderFocus,
  borderSubtle: tokens.colors.dark.borderSubtle,
  textPrimary: tokens.colors.dark.text.primary,
  textSecondary: tokens.colors.dark.text.secondary,
  textMuted: tokens.colors.dark.text.muted,
  textInverse: tokens.colors.dark.text.inverse,
  brand: tokens.colors.dark.brand,
  brandHover: tokens.colors.dark.brandHover,
  brandLight: tokens.colors.dark.brandLight,
  brandGlow: tokens.colors.dark.brandGlow,
  verified: tokens.colors.semantic.success,
  verifiedBg: tokens.colors.semantic.successBg,
  verifiedBorder: 'rgba(34, 197, 94, 0.3)',
  warning: tokens.colors.semantic.warning,
  warningBg: tokens.colors.semantic.warningBg,
  error: tokens.colors.semantic.error,
  errorBg: tokens.colors.semantic.errorBg,
  success: tokens.colors.semantic.success,
  successBg: tokens.colors.semantic.successBg,
};

export const typography = tokens.typography;
export const layout = {
  maxWidth: tokens.layout.maxWidth,
  borderRadius: tokens.borderRadius,
  spacing: tokens.spacing,
};

export type Theme = 'light' | 'dark' | 'system';
