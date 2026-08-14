import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Search, X } from 'lucide-react-native';

export interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText: (text: string) => void;
  debounceMs?: number;
  style?: ViewStyle;
}

export function SearchBar({
  placeholder = 'Search...',
  value: controlledValue,
  onChangeText,
  debounceMs = 300,
  style,
}: SearchBarProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  const [internalValue, setInternalValue] = useState(controlledValue || '');
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChangeText(internalValue);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [internalValue, debounceMs, onChangeText]);

  const handleClear = () => {
    setInternalValue('');
    onChangeText('');
  };

  return (
    <View
      className="flex-row items-center px-3.5 py-2.5 rounded-xl border"
      style={[
        {
          backgroundColor: isDark ? tokens.colors.dark.surface : '#f1f5f9',
          borderColor: activeColors.border,
        },
        style,
      ]}
    >
      <Search size={18} color={activeColors.text.muted} />
      <TextInput
        className="flex-1 ml-2.5 font-medium"
        style={{
          color: activeColors.text.primary,
          fontSize: tokens.typography.size.base,
          padding: 0,
        }}
        placeholder={placeholder}
        placeholderTextColor={activeColors.text.muted}
        value={internalValue}
        onChangeText={setInternalValue}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {internalValue.length > 0 && (
        <TouchableOpacity onPress={handleClear} className="p-1 rounded-full bg-slate-200 dark:bg-slate-700">
          <X size={14} color={activeColors.text.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
