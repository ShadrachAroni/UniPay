import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface DividerProps {
  style?: ViewStyle;
}

export function Divider({ style }: DividerProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  return (
    <View 
      style={[
        { 
          height: 1, 
          backgroundColor: activeColors.border,
          width: '100%' 
        }, 
        style
      ]} 
    />
  );
}
