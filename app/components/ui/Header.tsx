import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function Header({ title, subtitle, showBack = true, onBack, rightAction, style }: HeaderProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      className="flex-row items-center justify-between px-4 py-3 border-b"
      style={[
        {
          backgroundColor: activeColors.surface,
          borderColor: activeColors.border,
        },
        style,
      ]}
    >
      <View className="flex-row items-center flex-1">
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            className="mr-3 p-1.5 rounded-lg"
            style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={20} color={activeColors.text.primary} />
          </TouchableOpacity>
        )}
        <View className="flex-1">
          <Text
            className="font-bold"
            style={{
              color: activeColors.text.primary,
              fontSize: tokens.typography.size.lg,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{
                color: activeColors.text.secondary,
                fontSize: tokens.typography.size.xs,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {rightAction && <View className="ml-3 pl-2">{rightAction}</View>}
    </View>
  );
}
