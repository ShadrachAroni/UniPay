import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { X } from 'lucide-react-native';

export type ChipVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand';

export interface ChipProps {
  label: string;
  selected?: boolean;
  variant?: ChipVariant;
  onPress?: () => void;
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'sm' | 'md';
}

export function Chip({
  label,
  selected,
  variant = 'default',
  onPress,
  onRemove,
  style,
  textStyle,
  size = 'md',
}: ChipProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  const getVariantStyles = () => {
    if (selected) {
      return {
        bg: activeColors.brand,
        text: '#ffffff',
        border: 'transparent',
      };
    }

    switch (variant) {
      case 'success':
        return {
          bg: isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
          text: tokens.colors.semantic.success,
          border: isDark ? 'rgba(34, 197, 94, 0.3)' : '#86efac',
        };
      case 'warning':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
          text: tokens.colors.semantic.warning,
          border: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
        };
      case 'error':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
          text: tokens.colors.semantic.error,
          border: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
        };
      case 'info':
      case 'brand':
        return {
          bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
          text: activeColors.brand,
          border: isDark ? 'rgba(59, 130, 246, 0.3)' : '#93c5fd',
        };
      default:
        return {
          bg: isDark ? '#1e293b' : '#f1f5f9',
          text: activeColors.text.secondary,
          border: activeColors.border,
        };
    }
  };

  const vStyles = getVariantStyles();
  const isSm = size === 'sm';

  const content = (
    <View
      className="flex-row items-center justify-center rounded-full border"
      style={[
        {
          backgroundColor: vStyles.bg,
          borderColor: vStyles.border,
          paddingHorizontal: isSm ? 8 : 12,
          paddingVertical: isSm ? 2 : 5,
        },
        style,
      ]}
    >
      <Text
        className="font-semibold"
        style={[
          {
            color: vStyles.text,
            fontSize: isSm ? tokens.typography.size.xs : tokens.typography.size.sm,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>

      {onRemove && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1.5 rounded-full p-0.5"
          style={{ backgroundColor: selected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={12} color={vStyles.text} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
