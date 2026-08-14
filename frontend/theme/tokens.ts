export const tokens = {
  colors: {
    light: {
      brand: '#2563eb', // Primary brand color (blue)
      background: '#f8fafc', // App background
      surface: '#ffffff', // Card/Sheet background
      text: {
        primary: '#0f172a',
        secondary: '#475569',
        muted: '#94a3b8',
      },
      border: '#e2e8f0',
    },
    dark: {
      brand: '#3b82f6', // Slightly brighter for dark mode
      background: '#020617', // Very dark slate
      surface: '#0f172a', // Card background
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b',
      },
      border: '#1e293b',
    },
    status: {
      payment: {
        pending: '#eab308', // Yellow
        success: '#22c55e', // Green
        failed: '#94a3b8', // Grey
      },
      settlement: {
        pending: '#94a3b8', // Grey
        processing: '#3b82f6', // Blue
        settled: '#22c55e', // Green
      },
      payout: {
        pending: '#eab308',
        completed: '#22c55e',
        failed: '#ef4444',
      },
      expectedPayment: {
        open: '#3b82f6', // Blue
        partial: '#f59e0b', // Orange-ish yellow
        paid: '#22c55e', // Green
        overdue: '#ef4444', // Red
        cancelled: '#64748b', // Slate/Grey
      },
      pool: {
        open: '#3b82f6',
        closed: '#64748b',
        settled: '#22c55e',
      },
    },
    semantic: {
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
  },
  typography: {
    size: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 20,
      xl: 24,
      '2xl': 32,
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
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
    full: 9999,
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
    },
    dark: {
      card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
      },
    },
  },
} as const;

export type Theme = 'light' | 'dark' | 'system';
