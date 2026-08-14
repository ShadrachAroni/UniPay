import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Search, X } from 'lucide-react-native';

interface SearchBarProps {
  placeholder?: string;
  onChangeText: (text: string) => void;
  debounceMs?: number;
  style?: ViewStyle;
}

export function SearchBar({ placeholder = 'Search...', onChangeText, debounceMs = 300, style }: SearchBarProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  
  const [value, setValue] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onChangeText(value);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, debounceMs, onChangeText]);

  const handleClear = () => {
    setValue('');
    onChangeText('');
  };

  return (
    <View 
      className="flex-row items-center px-3 py-2 rounded-lg"
      style={[
        { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }, // slate-800 / slate-100
        style
      ]}
    >
      <Search size={18} color={activeColors.text.muted} />
      <TextInput
        className="flex-1 ml-2 font-medium"
        style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}
        placeholder={placeholder}
        placeholderTextColor={activeColors.text.muted}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} className="p-1">
          <X size={16} color={activeColors.text.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
