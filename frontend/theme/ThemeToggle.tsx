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
    <View className="flex-row items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
      {options.map((option) => {
        const isSelected = theme === option.value;
        const Icon = option.icon;
        
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => setTheme(option.value)}
            className={`flex-1 flex-row items-center justify-center py-2 px-3 rounded-md ${
              isSelected ? 'bg-white dark:bg-slate-700 shadow-sm' : ''
            }`}
          >
            <Icon 
              size={16} 
              color={
                isSelected 
                  ? (isDark ? tokens.colors.dark.text.primary : tokens.colors.light.text.primary)
                  : (isDark ? tokens.colors.dark.text.muted : tokens.colors.light.text.muted)
              } 
            />
            <Text 
              className={`ml-2 text-sm font-medium ${
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
