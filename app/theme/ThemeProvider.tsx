import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { tokens, Theme } from './tokens';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  tokens: typeof tokens;
  activeColors: typeof tokens.colors.dark | typeof tokens.colors.light;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@unipay_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const { setColorScheme: setNativeWindColorScheme } = useNativeWindColorScheme();
  const [theme, setThemeState] = useState<Theme>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load saved theme on mount
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedTheme) => {
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeState(savedTheme);
        }
        setIsLoaded(true);
      })
      .catch(() => {
        setIsLoaded(true);
      });
  }, []);

  const isDark = theme === 'system' ? systemColorScheme === 'dark' : theme === 'dark';

  useEffect(() => {
    // Keep NativeWind in sync with our resolved dark mode state
    if (setNativeWindColorScheme) {
      setNativeWindColorScheme(isDark ? 'dark' : 'light');
    }
  }, [isDark, setNativeWindColorScheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch(() => {});
  };

  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, tokens, activeColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return fallback if called outside provider in test or isolation
    return {
      theme: 'dark' as Theme,
      isDark: true,
      setTheme: () => {},
      tokens,
      activeColors: tokens.colors.dark,
    };
  }
  return context;
}
