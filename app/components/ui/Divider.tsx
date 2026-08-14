import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface DividerProps {
  style?: StyleProp<ViewStyle>;
  spacing?: number;
}

export function Divider({ style, spacing }: DividerProps) {
  const { isDark, tokens } = useTheme();
  const borderColor = isDark ? tokens.colors.dark.border : tokens.colors.light.border;

  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: borderColor,
          marginVertical: spacing ?? tokens.spacing.md,
          width: '100%',
        },
        style,
      ]}
    />
  );
}
