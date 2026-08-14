import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Monitor, Moon, Sun } from 'lucide-react-native';

export function ThemeToggle() {
  const { theme, setTheme, tokens, isDark } = useTheme();

  const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const;

  return (
    <View className="flex-row items-center bg-slate-200/80 dark:bg-slate-800 rounded-lg p-1 border border-slate-300 dark:border-slate-700/60">
      {options.map((option) => {
        const isSelected = theme === option.value;
        const Icon = option.icon;
        
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => setTheme(option.value)}
            className={`flex-1 flex-row items-center justify-center py-1.5 px-2.5 rounded-md ${
              isSelected ? 'bg-white dark:bg-slate-700 shadow-sm' : ''
            }`}
          >
            <Icon 
              size={14} 
              color={
                isSelected 
                  ? (isDark ? tokens.colors.dark.text.primary : tokens.colors.light.text.primary)
                  : (isDark ? tokens.colors.dark.text.muted : tokens.colors.light.text.muted)
              } 
            />
            <Text 
              className={`ml-1.5 text-xs font-semibold ${
                isSelected 
                  ? 'text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
