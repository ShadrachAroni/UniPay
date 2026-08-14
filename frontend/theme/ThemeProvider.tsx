import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useColorScheme as useRNColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { tokens, Theme } from './tokens';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  tokens: typeof tokens;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@unipay_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const rnColorScheme = useRNColorScheme();
  const { setColorScheme: setNativeWindColorScheme } = useNativeWindColorScheme();
  
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Helper to apply 'light' or 'dark' to NativeWind safely
  const applyNativeWind = useCallback((targetScheme: 'light' | 'dark') => {
    try {
      if (typeof setNativeWindColorScheme === 'function') {
        setNativeWindColorScheme(targetScheme);
      }
    } catch (e) {
      console.warn('NativeWind theme sync warning:', e);
    }
  }, [setNativeWindColorScheme]);

  // Compute resolved color scheme ('light' | 'dark')
  const effectiveScheme: 'light' | 'dark' = theme === 'system' ? systemScheme : theme;
  const isDark = effectiveScheme === 'dark';

  // Apply effective scheme to NativeWind whenever effectiveScheme updates
  useEffect(() => {
    applyNativeWind(effectiveScheme);
  }, [effectiveScheme, applyNativeWind]);

  // Listen to OS system color scheme changes
  useEffect(() => {
    const current = Appearance.getColorScheme();
    if (current === 'dark' || current === 'light') {
      setSystemScheme(current);
    }

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme === 'dark' || colorScheme === 'light') {
        setSystemScheme(colorScheme);
      }
    });

    return () => subscription.remove();
  }, [rnColorScheme]);

  // Load saved theme from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedTheme) => {
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeState(savedTheme as Theme);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  // User trigger to set theme selection
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch(() => {});
  }, []);

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

