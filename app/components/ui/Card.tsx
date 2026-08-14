import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'subtle' | 'glow' | 'outline' | 'elevated';
  className?: string;
}

export function Card({ children, style, variant = 'default', className }: CardProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const cardElevation = tokens.elevation[isDark ? 'dark' : 'light'].card;

  const getVariantStyle = () => {
    switch (variant) {
      case 'subtle':
        return {
          backgroundColor: activeColors.surfaceSubtle,
          borderColor: activeColors.borderSubtle,
        };
      case 'glow':
        return {
          backgroundColor: activeColors.surface,
          borderColor: activeColors.brand,
          shadowColor: activeColors.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.15,
          shadowRadius: 16,
          elevation: 6,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: activeColors.border,
        };
      case 'elevated':
        return {
          backgroundColor: activeColors.surface,
          borderColor: activeColors.border,
          ...tokens.elevation[isDark ? 'dark' : 'light'].floating,
        };
      default:
        return {
          backgroundColor: activeColors.surface,
          borderColor: activeColors.border,
          ...cardElevation,
        };
    }
  };

  return (
    <View
      className={className}
      style={[
        styles.baseCard,
        {
          borderRadius: tokens.borderRadius.lg,
        },
        getVariantStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  baseCard: {
    borderWidth: 1,
    padding: 16,
  },
});
